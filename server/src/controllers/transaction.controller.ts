import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ActivityLog } from '../models/ActivityLog.js';
import { PreOrderListing } from '../models/PreOrderListing.js';
import { Product, REGULAR_PRODUCT_FILTER } from '../models/Product.js';
import { Store } from '../models/Store.js';
import { demandForProducts } from './preorder.controller.js';
import { Transaction, type ClaimStatus, type OrderType, type PaymentStatus } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { User } from '../models/User.js';
import { getIO } from '../socket.js';
import { localDayRangeFromDateString } from '../config/timezone.js';
import { UserRole } from '../types/index.js';

interface CartItem {
  productId: string;
  quantity: number;
}

interface CreateTransactionBody {
  storeId: string;
  items: CartItem[];
  customerId?: string;
  walkInCustomerName?: string;
  claimStatus?: ClaimStatus;
  paymentStatus?: PaymentStatus;
  amountPaid?: number;
  notes?: string;
  customerNotes?: string;
  /** Only `preorder` is honored. Regular and walk-in are assigned by who is checking out. */
  orderType?: string;
}

async function broadcastPreOrderDemand(
  storeId: string,
  productIds: mongoose.Types.ObjectId[]
): Promise<void> {
  const unique = [...new Map(productIds.map((id) => [String(id), id])).values()];
  if (unique.length === 0) return;
  const io = getIO();
  const demand = await demandForProducts(unique);
  for (const id of unique) {
    const summary = demand.get(String(id)) ?? { totalUnits: 0, customerCount: 0 };
    io.to(`store:${storeId}`).emit('preorder:updated', {
      productId: String(id),
      totalUnits: summary.totalUnits,
      customerCount: summary.customerCount,
    });
  }
}

export const createTransaction = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const body = req.body as CreateTransactionBody;
    const { storeId, items } = body;

    if (!items?.length) {
      res.status(400).json({ message: 'Transaction must include at least one item' });
      await session.abortTransaction();
      return;
    }

    const store = await Store.findById(storeId).session(session);
    if (!store) {
      res.status(404).json({ message: 'Store not found' });
      await session.abortTransaction();
      return;
    }
    const isPreOrder = body.orderType === 'preorder';
    const orderType: OrderType = isPreOrder
      ? 'preorder'
      : req.user!.role === UserRole.CUSTOMER
        ? 'regular'
        : 'walk-in';

    if (!store.isOpen && !isPreOrder) {
      res.status(403).json({ message: 'This store is currently closed. Please try again later.' });
      await session.abortTransaction();
      return;
    }

    let totalAmount = 0;
    let totalCost = 0;

    const resolvedItems: Array<{
      productId: mongoose.Types.ObjectId;
      quantity: number;
      subtotal: number;
      costSubtotal: number;
    }> = [];
    const preOrderProductIds: mongoose.Types.ObjectId[] = [];

    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error('Each item quantity must be a whole number of at least 1');
      }

      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      if (isPreOrder) {
        if (product.productType !== 'preorder') {
          throw new Error(`"${product.name}" is not a pre-order product`);
        }
        if (!product.preOrderOpen) {
          throw new Error(`Pre-orders are closed for "${product.name}"`);
        }
        if (product.preOrderClosesAt && product.preOrderClosesAt.getTime() <= Date.now()) {
          throw new Error(`Pre-orders for "${product.name}" have closed`);
        }
        const openListing = await PreOrderListing.findOne({
          productId: product._id,
          unlistedAt: null,
        }).session(session);
        const anyListing = await PreOrderListing.exists({ productId: product._id }).session(session);
        if (anyListing && !openListing) {
          throw new Error(`"${product.name}" is no longer listed for pre-order`);
        }
        if (String(product.storeId) !== String(storeId)) {
          throw new Error(`"${product.name}" does not belong to this store`);
        }
        preOrderProductIds.push(product._id as mongoose.Types.ObjectId);
      } else {
        if (product.productType === 'preorder') {
          throw new Error(
            `"${product.name}" is a pre-order item. Place it from the Pre-Orders tab.`
          );
        }
        if (product.stockQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for "${product.name}" (available: ${product.stockQuantity})`
          );
        }
        product.stockQuantity -= item.quantity;
        await product.save({ session });
      }

      const effectivePrice =
        typeof product.discountPrice === 'number' && product.discountPrice >= 0
          ? Math.min(product.discountPrice, product.sellingPrice)
          : product.sellingPrice;
      const subtotal = effectivePrice * item.quantity;
      const costSubtotal = product.costPrice * item.quantity;

      totalAmount += subtotal;
      totalCost += costSubtotal;

      resolvedItems.push({
        productId: product._id as mongoose.Types.ObjectId,
        quantity: item.quantity,
        subtotal,
        costSubtotal,
      });
    }

    const grossProfit = totalAmount - totalCost;

    const isStaff = req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.STORE_MANAGER;
    const customerId =
      req.user!.role === UserRole.CUSTOMER
        ? req.user!.userId
        : isStaff && body.customerId
          ? body.customerId
          : undefined;
    const walkInCustomerName =
      isStaff && body.walkInCustomerName?.trim()
        ? body.walkInCustomerName.trim()
        : undefined;
    const claimStatus =
      isStaff && body.claimStatus && ['unclaimed', 'claimed'].includes(body.claimStatus)
        ? body.claimStatus
        : 'unclaimed';
    let paymentStatus: PaymentStatus = 'unpaid';
    let amountPaid = 0;
    if (isStaff && body.paymentStatus && ['unpaid', 'paid', 'partial'].includes(body.paymentStatus)) {
      paymentStatus = body.paymentStatus as PaymentStatus;
      if (paymentStatus === 'partial') {
        const raw = typeof body.amountPaid === 'number' ? body.amountPaid : Number(body.amountPaid);
        amountPaid = Number.isFinite(raw) ? Math.max(0, Math.min(raw, totalAmount - 0.01)) : 0;
      } else if (paymentStatus === 'paid') {
        amountPaid = totalAmount;
      }
    }

    const notes =
      typeof body.notes === 'string' && body.notes.trim()
        ? body.notes.trim()
        : null;
    const customerNotes =
      typeof body.customerNotes === 'string' && body.customerNotes.trim()
        ? body.customerNotes.trim()
        : null;

    const now = new Date();

    const [transaction] = await Transaction.create(
      [{
        storeId,
        totalAmount,
        totalCost,
        grossProfit,
        customerId: customerId ?? null,
        walkInCustomerName: walkInCustomerName ?? null,
        claimStatus,
        paymentStatus,
        amountPaid,
        orderType,
        claimedAt: claimStatus === 'claimed' ? now : null,
        paidAt: paymentStatus === 'paid' ? now : null,
        notes,
        customerNotes,
      }],
      { session }
    );

    const txItems = resolvedItems.map((i) => ({ ...i, transactionId: transaction._id }));
    await TransactionItem.insertMany(txItems, { session });

    await session.commitTransaction();

    try {
      const io = getIO();
      if (!isPreOrder) {
        const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
        io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
      } else {
        await broadcastPreOrderDemand(storeId, preOrderProductIds);
      }

      const populatedTx = await Transaction.findById(transaction._id)
        .populate('customerId', 'name email')
        .lean();
      io.to(`store:${storeId}`).emit('transaction:created', populatedTx);

      // The feed names the customer on the order, not the staff member who entered it.
      let actorName = walkInCustomerName || 'Walk-in customer';
      let actorAvatar: string | null = null;
      if (customerId) {
        const userDoc = await User.findById(customerId).select('name avatar').lean();
        if (userDoc?.name) actorName = userDoc.name;
        actorAvatar = userDoc?.avatar || null;
      }

      const activityDoc = await ActivityLog.create({
        storeId,
        type: isPreOrder ? 'preorder_placed' : 'reservation_created',
        actorName,
        actorAvatar,
        message: isPreOrder
          ? `${actorName} placed a pre-order`
          : `${actorName} placed a reservation`,
        metadata: { transactionId: String(transaction._id), totalAmount, orderType },
      });
      io.to(`store:${storeId}`).emit('activity:new', activityDoc);
    } catch { /* socket broadcast is non-critical */ }

    res.status(201).json({ transaction, items: txItems });
  } catch (err: unknown) {
    await session.abortTransaction();
    const message = err instanceof Error ? err.message : 'Transaction failed';
    res.status(400).json({ message });
  } finally {
    session.endSession();
  }
};

export const getTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, claimStatus, paymentStatus, orderStatus, orderType, customerName, productId, dateFrom, dateTo } = req.query;
    const filter: Record<string, unknown> = {};
    if (storeId) filter.storeId = storeId;
    if (claimStatus && claimStatus !== 'all') filter.claimStatus = claimStatus;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (orderStatus === 'completed') {
      filter.orderStatus = { $ne: 'cancelled' };
      filter.$and = [{ claimStatus: 'claimed' }, { paymentStatus: 'paid' }];
    } else if (orderStatus === 'active') {
      filter.orderStatus = 'active';
      filter.$nor = [{ claimStatus: 'claimed', paymentStatus: 'paid' }];
    } else if (orderStatus && orderStatus !== 'all') {
      filter.orderStatus = orderStatus;
    }

    if (orderType === 'regular') {
      // Missing field on older documents means regular.
      filter.orderType = { $in: ['regular', null] };
    } else if (orderType === 'walk-in' || orderType === 'preorder') {
      filter.orderType = orderType;
    }

    const fromStr = typeof dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : null;
    const toStr = typeof dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : null;
    if (fromStr && toStr) {
      const { dayStart } = localDayRangeFromDateString(fromStr);
      const { dayEnd } = localDayRangeFromDateString(toStr);
      filter.createdAt = { $gte: dayStart, $lte: dayEnd };
    } else if (fromStr) {
      const { dayStart, dayEnd } = localDayRangeFromDateString(fromStr);
      filter.createdAt = { $gte: dayStart, $lte: dayEnd };
    } else if (toStr) {
      const { dayStart, dayEnd } = localDayRangeFromDateString(toStr);
      filter.createdAt = { $gte: dayStart, $lte: dayEnd };
    }

    if (productId && typeof productId === 'string') {
      const txIds = await TransactionItem.distinct('transactionId', { productId });
      if (txIds.length === 0) {
        res.json([]);
        return;
      }
      filter._id = { $in: txIds };
    }

    let transactions = await Transaction.find(filter)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const customerSearch = typeof customerName === 'string' ? customerName.trim().toLowerCase() : '';
    if (customerSearch) {
      transactions = transactions.filter((tx) => {
        const cust = tx.customerId as unknown as { name?: string; email?: string } | null;
        const nameMatch = cust?.name?.toLowerCase().includes(customerSearch);
        const emailMatch = cust?.email?.toLowerCase().includes(customerSearch);
        const walkInMatch = (tx.walkInCustomerName ?? '').toLowerCase().includes(customerSearch);
        return !!(nameMatch || emailMatch || walkInMatch);
      });
    }

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }
    const items = await TransactionItem.find({ transactionId: transaction._id }).populate(
      'productId',
      'name sellingPrice costPrice'
    );
    res.json({ transaction, items });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateTransactionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimStatus, paymentStatus, amountPaid: bodyAmountPaid } = req.body;
    const update: Record<string, unknown> = {};

    const existing = await Transaction.findById(req.params.id)
      .select('totalAmount claimStatus paymentStatus claimedAt paidAt')
      .lean();
    if (!existing) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    if (claimStatus && ['unclaimed', 'claimed'].includes(claimStatus)) {
      update.claimStatus = claimStatus;
      if (claimStatus === 'claimed') {
        if (existing.claimStatus !== 'claimed' || !existing.claimedAt) update.claimedAt = new Date();
      } else {
        update.claimedAt = null;
      }
    }
    if (paymentStatus && ['unpaid', 'paid', 'partial'].includes(paymentStatus)) {
      update.paymentStatus = paymentStatus;
      if (paymentStatus === 'paid') {
        update.amountPaid = existing.totalAmount;
        if (existing.paymentStatus !== 'paid' || !existing.paidAt) update.paidAt = new Date();
      } else {
        update.paidAt = null;
        if (paymentStatus === 'unpaid') {
          update.amountPaid = 0;
        } else if (typeof bodyAmountPaid === 'number') {
          const totalAmount = existing.totalAmount as number;
          update.amountPaid = Number.isFinite(bodyAmountPaid)
            ? Math.max(0, Math.min(bodyAmountPaid, totalAmount - 0.01))
            : 0;
        }
      }
    }

    if (Object.keys(update).length === 0) {
      res.status(400).json({ message: 'No valid status fields provided' });
      return;
    }

    const transaction = await Transaction.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('customerId', 'name email');

    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    try {
      const io = getIO();
      io.to(`store:${transaction.storeId}`).emit('transaction:updated', transaction.toJSON());
      if (transaction.orderType === 'preorder') {
        const lines = await TransactionItem.find({ transactionId: transaction._id }).select('productId').lean();
        await broadcastPreOrderDemand(
          String(transaction.storeId),
          lines.map((line) => line.productId as mongoose.Types.ObjectId)
        );
      }
    } catch { /* socket broadcast is non-critical */ }

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateTransactionCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId: bodyCustomerId, walkInCustomerName: bodyWalkInName } = req.body as {
      customerId?: string | null;
      walkInCustomerName?: string | null;
    };

    const update: Record<string, unknown> = {};

    if (bodyCustomerId && typeof bodyCustomerId === 'string' && mongoose.Types.ObjectId.isValid(bodyCustomerId)) {
      const user = await User.findById(bodyCustomerId).select('_id').lean();
      if (!user) {
        res.status(404).json({ message: 'Customer not found' });
        return;
      }
      update.customerId = bodyCustomerId;
      update.walkInCustomerName = null;
    } else {
      update.customerId = null;
      update.walkInCustomerName =
        typeof bodyWalkInName === 'string' && bodyWalkInName.trim()
          ? bodyWalkInName.trim()
          : null;
    }

    const transaction = await Transaction.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('customerId', 'name email');

    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    try {
      const io = getIO();
      io.to(`store:${transaction.storeId}`).emit('transaction:updated', transaction.toJSON());
    } catch { /* socket broadcast is non-critical */ }

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateTransactionNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notes: bodyNotes } = req.body as { notes?: string };
    const notes = typeof bodyNotes === 'string' && bodyNotes.trim() ? bodyNotes.trim() : null;

    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { notes },
      { new: true }
    )
      .populate('customerId', 'name email');

    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    try {
      const io = getIO();
      io.to(`store:${transaction.storeId}`).emit('transaction:updated', transaction.toJSON());
    } catch { /* socket broadcast is non-critical */ }

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const cancelTransaction = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findById(req.params.id).session(session);
    if (!transaction) {
      await session.abortTransaction();
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    if (transaction.orderStatus === 'cancelled') {
      await session.abortTransaction();
      res.status(400).json({ message: 'Transaction is already cancelled' });
      return;
    }

    const items = await TransactionItem.find({ transactionId: transaction._id }).session(session);
    const restoresStock = transaction.orderType !== 'preorder';

    if (restoresStock) {
      for (const item of items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQuantity: item.quantity } },
          { session }
        );
      }
    }

    transaction.orderStatus = 'cancelled';
    await transaction.save({ session });

    await session.commitTransaction();

    const populated = await Transaction.findById(transaction._id)
      .populate('customerId', 'name email')
      .lean();

    try {
      const io = getIO();
      const storeId = String(transaction.storeId);
      if (restoresStock) {
        const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
        io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
      } else {
        await broadcastPreOrderDemand(
          storeId,
          items.map((item) => item.productId as mongoose.Types.ObjectId)
        );
      }
      io.to(`store:${storeId}`).emit('transaction:updated', populated);
    } catch { /* socket broadcast is non-critical */ }

    res.json(populated);
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Server error', error: err });
  } finally {
    session.endSession();
  }
};

export const deleteTransaction = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findById(req.params.id).session(session);
    if (!transaction) {
      await session.abortTransaction();
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }

    const items = await TransactionItem.find({ transactionId: transaction._id }).session(session);
    const restoresStock =
      transaction.orderType !== 'preorder' && transaction.orderStatus !== 'cancelled';

    if (restoresStock) {
      for (const item of items) {
        await Product.findByIdAndUpdate(
          item.productId,
          { $inc: { stockQuantity: item.quantity } },
          { session }
        );
      }
    }

    await TransactionItem.deleteMany({ transactionId: transaction._id }).session(session);
    await Transaction.findByIdAndDelete(transaction._id).session(session);

    await session.commitTransaction();

    const storeId = String(transaction.storeId);
    try {
      const io = getIO();
      if (transaction.orderType === 'preorder') {
        await broadcastPreOrderDemand(
          storeId,
          items.map((item) => item.productId as mongoose.Types.ObjectId)
        );
      } else if (restoresStock) {
        const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
        io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
      }
    } catch { /* socket broadcast is non-critical */ }

    res.status(204).send();
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: 'Server error', error: err });
  } finally {
    session.endSession();
  }
};

export const getMyPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const transactions = await Transaction.find({ customerId: req.user!.userId })
      .populate('storeId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (transactions.length === 0) {
      res.json([]);
      return;
    }

    const txIds = transactions.map((t) => t._id);
    const items = await TransactionItem.find({ transactionId: { $in: txIds } })
      .populate('productId', 'name sellingPrice')
      .lean();

    const itemsByTx = new Map<string, Array<{ productId: string; productName: string; quantity: number; subtotal: number; sellingPrice: number }>>();
    for (const item of items) {
      const txId = String(item.transactionId);
      const product = item.productId as unknown as { _id: unknown; name: string; sellingPrice: number } | null;
      const list = itemsByTx.get(txId) ?? [];
      list.push({
        productId: String(product?._id ?? item.productId),
        productName: product?.name ?? 'Unknown',
        quantity: item.quantity,
        subtotal: item.subtotal,
        sellingPrice: product?.sellingPrice ?? 0,
      });
      itemsByTx.set(txId, list);
    }

    const result = transactions.map((tx) => ({
      ...tx,
      items: itemsByTx.get(String(tx._id)) ?? [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
