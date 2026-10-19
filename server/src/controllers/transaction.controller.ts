import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ActivityLog } from '../models/ActivityLog.js';
import { PreOrderListing } from '../models/PreOrderListing.js';
import { Product, REGULAR_PRODUCT_FILTER } from '../models/Product.js';
import { Store } from '../models/Store.js';
import { demandForProducts } from './preorder.controller.js';
import { PaymentOption } from '../models/PaymentOption.js';
import { Transaction, type ClaimStatus, type ITransaction, type OrderType, type PaymentMethod, type PaymentStatus } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { User } from '../models/User.js';
import { adjustReservedLines } from '../services/inventoryReconciliation.js';
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
  paymentMethod?: PaymentMethod;
  paymentOptionId?: string;
  paymentReferenceLast4?: string;
  /** Shop checkout. Uses the customer payment rules even when the account also has a staff role. */
  placedFrom?: 'shop';
}

interface ResolvedPayment {
  paymentMethod: PaymentMethod | null;
  paymentOptionId: mongoose.Types.ObjectId | null;
  paymentOptionLabel: string | null;
  paymentReferenceLast4: string | null;
}

const EMPTY_PAYMENT: ResolvedPayment = {
  paymentMethod: null,
  paymentOptionId: null,
  paymentOptionLabel: null,
  paymentReferenceLast4: null,
};

function effectiveUnitPrice(product: { sellingPrice: number; discountPrice?: number | null }): number {
  return typeof product.discountPrice === 'number' && product.discountPrice >= 0
    ? Math.min(product.discountPrice, product.sellingPrice)
    : product.sellingPrice;
}

/**
 * Cash marks the order paid and clears any QR fields.
 * Bank/QR requires an active option for the store. Paid QR also requires 4 reference digits.
 * Postponed QR stays unpaid and stores the option without a reference.
 */
async function resolveStaffPayment(input: {
  storeId: mongoose.Types.ObjectId | string;
  paymentStatus: PaymentStatus;
  paymentMethod?: unknown;
  paymentOptionId?: unknown;
  paymentReferenceLast4?: unknown;
  session?: mongoose.ClientSession;
}): Promise<ResolvedPayment> {
  const method = input.paymentMethod === 'cash' || input.paymentMethod === 'bank_qr'
    ? input.paymentMethod
    : null;

  if (input.paymentStatus === 'partial' || (input.paymentStatus === 'unpaid' && method !== 'bank_qr')) {
    return EMPTY_PAYMENT;
  }

  if (input.paymentStatus === 'paid' && method !== 'bank_qr') {
    return { ...EMPTY_PAYMENT, paymentMethod: 'cash' };
  }

  const optionId = typeof input.paymentOptionId === 'string' ? input.paymentOptionId : '';
  if (!mongoose.Types.ObjectId.isValid(optionId)) {
    throw new Error('Select a QR payment option');
  }

  let optionQuery = PaymentOption.findOne({
    _id: optionId,
    storeId: input.storeId,
    isActive: true,
  });
  if (input.session) optionQuery = optionQuery.session(input.session);
  const option = await optionQuery;
  if (!option) {
    throw new Error('That QR payment option is not available');
  }

  const label = option.label?.trim() || option.recipientName;
  if (input.paymentStatus !== 'paid') {
    return {
      paymentMethod: 'bank_qr',
      paymentOptionId: option._id as mongoose.Types.ObjectId,
      paymentOptionLabel: label,
      paymentReferenceLast4: null,
    };
  }

  const digits = typeof input.paymentReferenceLast4 === 'string'
    ? input.paymentReferenceLast4.trim()
    : '';
  if (!/^\d{4}$/.test(digits)) {
    throw new Error('Enter the last 4 digits of the payment reference');
  }

  return {
    paymentMethod: 'bank_qr',
    paymentOptionId: option._id as mongoose.Types.ObjectId,
    paymentOptionLabel: label,
    paymentReferenceLast4: digits,
  };
}

/**
 * Customers choose before the order exists.
 * Cash means they will pay in person, so the order stays unpaid.
 * Bank/QR still requires the reference digits, but the order stays unpaid
 * until a manager confirms those digits match the payment they received.
 */
async function resolveCustomerPayment(input: {
  storeId: mongoose.Types.ObjectId | string;
  paymentMethod?: unknown;
  paymentOptionId?: unknown;
  paymentReferenceLast4?: unknown;
  session?: mongoose.ClientSession;
}): Promise<{ paymentStatus: PaymentStatus; amountPaid: number; capture: ResolvedPayment }> {
  if (input.paymentMethod === 'cash') {
    return {
      paymentStatus: 'unpaid',
      amountPaid: 0,
      capture: { ...EMPTY_PAYMENT, paymentMethod: 'cash' },
    };
  }

  if (input.paymentMethod !== 'bank_qr') {
    throw new Error('Choose cash or a bank/QR payment');
  }

  const capture = await resolveStaffPayment({
    storeId: input.storeId,
    paymentStatus: 'paid',
    paymentMethod: 'bank_qr',
    paymentOptionId: input.paymentOptionId,
    paymentReferenceLast4: input.paymentReferenceLast4,
    session: input.session,
  });

  return {
    paymentStatus: 'unpaid',
    amountPaid: 0,
    capture,
  };
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
    const shopCheckout = body.placedFrom === 'shop';
    const orderType: OrderType = isPreOrder
      ? 'preorder'
      : req.user!.role === UserRole.CUSTOMER || shopCheckout
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
          source: { $ne: 'inventory' },
        }).session(session);
        const anyListing = await PreOrderListing.exists({
          productId: product._id,
          source: { $ne: 'inventory' },
        }).session(session);
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

    const isStaff =
      (req.user!.role === UserRole.ADMIN || req.user!.role === UserRole.STORE_MANAGER) && !shopCheckout;
    const customerId =
      req.user!.role === UserRole.CUSTOMER || shopCheckout
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
    let paymentCapture: ResolvedPayment;
    if (isStaff) {
      if (body.paymentStatus && ['unpaid', 'paid', 'partial'].includes(body.paymentStatus)) {
        paymentStatus = body.paymentStatus as PaymentStatus;
        if (paymentStatus === 'partial') {
          const raw = typeof body.amountPaid === 'number' ? body.amountPaid : Number(body.amountPaid);
          amountPaid = Number.isFinite(raw) ? Math.max(0, Math.min(raw, totalAmount - 0.01)) : 0;
        } else if (paymentStatus === 'paid') {
          amountPaid = totalAmount;
        }
      }
      paymentCapture = await resolveStaffPayment({
        storeId,
        paymentStatus,
        paymentMethod: body.paymentMethod,
        paymentOptionId: body.paymentOptionId,
        paymentReferenceLast4: body.paymentReferenceLast4,
        session,
      });
    } else {
      const customerPayment = await resolveCustomerPayment({
        storeId,
        paymentMethod: body.paymentMethod,
        paymentOptionId: body.paymentOptionId,
        paymentReferenceLast4: body.paymentReferenceLast4,
        session,
      });
      paymentStatus = customerPayment.paymentStatus;
      amountPaid = customerPayment.amountPaid;
      paymentCapture = customerPayment.capture;
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
        paymentMethod: paymentCapture.paymentMethod,
        paymentOptionId: paymentCapture.paymentOptionId,
        paymentOptionLabel: paymentCapture.paymentOptionLabel,
        paymentReferenceLast4: paymentCapture.paymentReferenceLast4,
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

      const payPhrase = paymentCapture.paymentMethod === 'bank_qr' && paymentCapture.paymentReferenceLast4 && paymentStatus === 'unpaid'
        ? ' and sent a QR payment for review'
        : paymentCapture.paymentMethod === 'bank_qr' && paymentStatus === 'paid'
          ? ' and paid by QR'
          : paymentCapture.paymentMethod === 'cash' && paymentStatus === 'unpaid'
            ? ' to pay cash in person'
            : paymentCapture.paymentMethod === 'cash' && paymentStatus === 'paid'
              ? ' and paid in cash'
              : '';
      const activityDoc = await ActivityLog.create({
        storeId,
        type: isPreOrder ? 'preorder_placed' : 'reservation_created',
        actorName,
        actorAvatar,
        message: isPreOrder
          ? `${actorName} placed a pre-order${payPhrase}`
          : `${actorName} placed a reservation${payPhrase}`,
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
    } else if (orderStatus === 'cancel-requested') {
      filter.orderStatus = 'active';
      filter['cancellationRequest.status'] = 'pending';
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

export const updateTransactionItems = async (req: Request, res: Response): Promise<void> => {
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
      throw new Error('Cancelled orders cannot be edited');
    }

    const body = req.body as { items?: CartItem[] };
    const requested = new Map<string, number>();
    for (const item of body.items ?? []) {
      if (!item?.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
        throw new Error('Each item needs a product');
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error('Each item quantity must be a whole number of at least 1');
      }
      requested.set(item.productId, (requested.get(item.productId) ?? 0) + item.quantity);
    }
    if (requested.size === 0) {
      throw new Error('Keep at least one product. Cancel the order to remove everything.');
    }

    const existingItems = await TransactionItem.find({ transactionId: transaction._id }).session(session);
    const existingMap = new Map<string, { quantity: number; subtotal: number; costSubtotal: number }>();
    for (const line of existingItems) {
      const id = String(line.productId);
      const prev = existingMap.get(id);
      if (prev) {
        prev.quantity += line.quantity;
        prev.subtotal += line.subtotal;
        prev.costSubtotal += line.costSubtotal;
      } else {
        existingMap.set(id, {
          quantity: line.quantity,
          subtotal: line.subtotal,
          costSubtotal: line.costSubtotal,
        });
      }
    }

    const isPreOrder = transaction.orderType === 'preorder';
    const productIds = new Set<string>([...existingMap.keys(), ...requested.keys()]);
    const resolved: Array<{
      transactionId: mongoose.Types.ObjectId;
      productId: mongoose.Types.ObjectId;
      quantity: number;
      subtotal: number;
      costSubtotal: number;
    }> = [];
    const changes: Array<{ productId: string; name: string; from: number; to: number }> = [];

    for (const productId of productIds) {
      const previous = existingMap.get(productId);
      const oldQty = previous?.quantity ?? 0;
      const newQty = requested.get(productId) ?? 0;
      if (newQty === 0 && oldQty === 0) continue;

      const product = await Product.findById(productId).session(session);
      if (!product) {
        if (newQty === 0) continue;
        throw new Error('A product on this order no longer exists');
      }
      if (String(product.storeId) !== String(transaction.storeId)) {
        throw new Error(`"${product.name}" does not belong to this store`);
      }
      if (isPreOrder && product.productType !== 'preorder') {
        throw new Error(`"${product.name}" is not a pre-order product`);
      }
      if (!isPreOrder && product.productType === 'preorder') {
        throw new Error(`"${product.name}" is a pre-order item. Place it from the Pre-Orders tab.`);
      }

      const delta = newQty - oldQty;
      if (!isPreOrder && delta > 0) {
        const updated = await Product.findOneAndUpdate(
          { _id: product._id, stockQuantity: { $gte: delta } },
          { $inc: { stockQuantity: -delta } },
          { session, new: true }
        );
        if (!updated) {
          throw new Error(`Insufficient stock for "${product.name}" (available: ${product.stockQuantity})`);
        }
      } else if (!isPreOrder && delta < 0) {
        await Product.updateOne(
          { _id: product._id },
          { $inc: { stockQuantity: -delta } },
          { session }
        );
      }

      if (newQty > 0) {
        const unitPrice = previous && previous.quantity > 0
          ? previous.subtotal / previous.quantity
          : effectiveUnitPrice(product);
        const unitCost = previous && previous.quantity > 0
          ? previous.costSubtotal / previous.quantity
          : product.costPrice;
        resolved.push({
          transactionId: transaction._id as mongoose.Types.ObjectId,
          productId: product._id as mongoose.Types.ObjectId,
          quantity: newQty,
          subtotal: unitPrice * newQty,
          costSubtotal: unitCost * newQty,
        });
      }

      if (delta !== 0) {
        changes.push({ productId, name: product.name, from: oldQty, to: newQty });
      }
    }

    if (resolved.length === 0) {
      throw new Error('Keep at least one product. Cancel the order to remove everything.');
    }

    const totalAmount = resolved.reduce((sum, line) => sum + line.subtotal, 0);
    const totalCost = resolved.reduce((sum, line) => sum + line.costSubtotal, 0);

    await TransactionItem.deleteMany({ transactionId: transaction._id }).session(session);
    await TransactionItem.insertMany(resolved, { session });

    transaction.totalAmount = totalAmount;
    transaction.totalCost = totalCost;
    transaction.grossProfit = totalAmount - totalCost;
    if (transaction.paymentStatus === 'paid') {
      transaction.amountPaid = totalAmount;
    } else if (transaction.paymentStatus === 'partial') {
      if (transaction.amountPaid >= totalAmount) {
        transaction.paymentStatus = 'paid';
        transaction.amountPaid = totalAmount;
        if (!transaction.paidAt) transaction.paidAt = new Date();
      } else {
        transaction.amountPaid = Math.min(transaction.amountPaid, Math.max(0, totalAmount - 0.01));
      }
    }
    await transaction.save({ session });
    await session.commitTransaction();

    const populated = await Transaction.findById(transaction._id).populate('customerId', 'name email');
    const items = await TransactionItem.find({ transactionId: transaction._id }).populate(
      'productId',
      'name sellingPrice costPrice'
    );

    try {
      const io = getIO();
      if (!isPreOrder) {
        const updatedProducts = await Product.find({
          storeId: transaction.storeId,
          ...REGULAR_PRODUCT_FILTER,
        }).lean();
        io.to(`store:${transaction.storeId}`).emit('stock:updated', updatedProducts);
      } else {
        await broadcastPreOrderDemand(
          String(transaction.storeId),
          resolved.map((line) => line.productId)
        );
      }
      if (populated) {
        io.to(`store:${transaction.storeId}`).emit('transaction:updated', populated.toJSON());
      }
      const activityDoc = await ActivityLog.create({
        storeId: transaction.storeId,
        type: 'transaction_edited',
        actorName: req.user?.name || 'Staff',
        actorAvatar: req.user?.avatar || null,
        message: `${req.user?.name || 'Staff'} edited an order`,
        metadata: { transactionId: String(transaction._id), changes },
      });
      io.to(`store:${transaction.storeId}`).emit('activity:new', activityDoc);
    } catch { /* socket broadcast is non-critical */ }

    res.json({ transaction: populated, items });
  } catch (err: unknown) {
    await session.abortTransaction();
    const message = err instanceof Error ? err.message : 'Could not update the order';
    const status = message === 'Transaction not found' ? 404 : 400;
    if (!res.headersSent) res.status(status).json({ message });
  } finally {
    session.endSession();
  }
};

export const updateTransactionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimStatus, paymentStatus, amountPaid: bodyAmountPaid, paymentMethod, paymentOptionId, paymentReferenceLast4, confirmStoredReference } = req.body as {
      claimStatus?: string;
      paymentStatus?: string;
      amountPaid?: number;
      paymentMethod?: string;
      paymentOptionId?: string;
      paymentReferenceLast4?: string;
      confirmStoredReference?: boolean;
    };
    const update: Record<string, unknown> = {};

    const existing = await Transaction.findById(req.params.id)
      .select('totalAmount claimStatus paymentStatus paymentMethod paymentReferenceLast4 claimedAt paidAt storeId orderType')
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
    const settingPaid = paymentStatus === 'paid';
    const postponingQr = paymentStatus === 'unpaid' && paymentMethod === 'bank_qr';
    if (settingPaid || postponingQr) {
      if (existing.paymentStatus === 'paid') {
        res.status(409).json({ message: 'This order is already paid' });
        return;
      }
    }
    if (paymentStatus && ['unpaid', 'paid', 'partial'].includes(paymentStatus)) {
      if (paymentStatus === 'paid' && confirmStoredReference === true) {
        if (existing.paymentMethod !== 'bank_qr' || !existing.paymentReferenceLast4) {
          res.status(400).json({ message: 'This order has no QR reference to confirm' });
          return;
        }
        update.paymentStatus = 'paid';
        update.amountPaid = existing.totalAmount;
        update.paidAt = existing.paidAt ?? new Date();
      } else if (paymentStatus === 'paid' || postponingQr) {
        const captured = await resolveStaffPayment({
          storeId: existing.storeId as mongoose.Types.ObjectId,
          paymentStatus: paymentStatus as PaymentStatus,
          paymentMethod,
          paymentOptionId,
          paymentReferenceLast4,
        });
        update.paymentStatus = paymentStatus;
        update.paymentMethod = captured.paymentMethod;
        update.paymentOptionId = captured.paymentOptionId;
        update.paymentOptionLabel = captured.paymentOptionLabel;
        update.paymentReferenceLast4 = captured.paymentReferenceLast4;
        if (paymentStatus === 'paid') {
          update.amountPaid = existing.totalAmount;
          update.paidAt = existing.paidAt ?? new Date();
        } else {
          update.amountPaid = 0;
          update.paidAt = null;
        }
      } else if (paymentStatus === 'unpaid') {
        update.paymentStatus = 'unpaid';
        update.paidAt = null;
        update.amountPaid = 0;
        update.paymentMethod = null;
        update.paymentOptionId = null;
        update.paymentOptionLabel = null;
        update.paymentReferenceLast4 = null;
      } else {
        update.paymentStatus = 'partial';
        update.paidAt = null;
        if (typeof bodyAmountPaid === 'number') {
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

    const query = settingPaid || postponingQr
      ? { _id: req.params.id, paymentStatus: { $ne: 'paid' } }
      : { _id: req.params.id };
    const nextClaim = (typeof update.claimStatus === 'string' ? update.claimStatus : existing.claimStatus) as string;
    const nextPay = (typeof update.paymentStatus === 'string' ? update.paymentStatus : existing.paymentStatus) as string;
    const wasFulfilled = existing.paymentStatus === 'paid' && existing.claimStatus === 'claimed';
    const nowFulfilled = nextPay === 'paid' && nextClaim === 'claimed';
    const reservationShift = existing.orderType === 'preorder' && wasFulfilled !== nowFulfilled;

    let transaction: ITransaction | null = null;
    if (reservationShift) {
      const session = await mongoose.startSession();
      try {
        session.startTransaction();
        const updated = await Transaction.findOneAndUpdate(query, update, { new: true, session });
        if (!updated) {
          await session.abortTransaction();
        } else {
          const lines = await TransactionItem.find({ transactionId: updated._id }).session(session);
          await adjustReservedLines(
            lines.map((line) => ({
              productId: line.productId as mongoose.Types.ObjectId,
              quantity: line.quantity,
            })),
            nowFulfilled ? 'fulfill' : 'restore',
            session,
            { userId: req.user?.userId }
          );
          await session.commitTransaction();
          transaction = updated;
        }
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
      if (transaction) {
        transaction = await Transaction.findById(transaction._id).populate('customerId', 'name email');
      }
    } else {
      transaction = await Transaction.findOneAndUpdate(query, update, { new: true })
        .populate('customerId', 'name email');
    }

    if (!transaction) {
      if (settingPaid || postponingQr) {
        const current = await Transaction.findById(req.params.id).select('paymentStatus').lean();
        if (current?.paymentStatus === 'paid') {
          res.status(409).json({ message: 'This order is already paid' });
          return;
        }
      }
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
      if (reservationShift) {
        const updatedProducts = await Product.find({
          storeId: transaction.storeId,
          ...REGULAR_PRODUCT_FILTER,
        }).lean();
        io.to(`store:${transaction.storeId}`).emit('stock:updated', updatedProducts);
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

type CancelOutcome =
  | { ok: true; transaction: unknown }
  | { ok: false; status: number; message: string };

/**
 * Cancels an order: restores stock for regular orders, re-broadcasts pre-order demand, and closes any
 * pending customer cancellation request as approved. Shared by the manager's cancel button and by
 * approving a customer's request.
 */
async function performCancellation(
  transactionId: string,
  actor?: { userId?: string | null }
): Promise<CancelOutcome> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const transaction = await Transaction.findById(transactionId).session(session);
    if (!transaction) {
      await session.abortTransaction();
      return { ok: false, status: 404, message: 'Transaction not found' };
    }

    if (transaction.orderStatus === 'cancelled') {
      await session.abortTransaction();
      return { ok: false, status: 400, message: 'Transaction is already cancelled' };
    }

    const items = await TransactionItem.find({ transactionId: transaction._id }).session(session);
    const restoresStock = transaction.orderType !== 'preorder';
    const alreadyFulfilled = transaction.paymentStatus === 'paid' && transaction.claimStatus === 'claimed';
    const releasedReservation = !restoresStock && !alreadyFulfilled
      ? await adjustReservedLines(
        items.map((item) => ({
          productId: item.productId as mongoose.Types.ObjectId,
          quantity: item.quantity,
        })),
        'release',
        session,
        actor
      )
      : false;

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
    if (transaction.cancellationRequest?.status === 'pending') {
      transaction.cancellationRequest.status = 'approved';
      transaction.cancellationRequest.resolvedAt = new Date();
    }
    await transaction.save({ session });

    await session.commitTransaction();

    const populated = await Transaction.findById(transaction._id)
      .populate('customerId', 'name email')
      .lean();

    try {
      const io = getIO();
      const storeId = String(transaction.storeId);
      if (restoresStock || releasedReservation) {
        const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
        io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
      }
      if (!restoresStock) {
        await broadcastPreOrderDemand(
          storeId,
          items.map((item) => item.productId as mongoose.Types.ObjectId)
        );
      }
      io.to(`store:${storeId}`).emit('transaction:updated', populated);
    } catch { /* socket broadcast is non-critical */ }

    return { ok: true, transaction: populated };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export const cancelTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const outcome = await performCancellation(req.params.id as string, { userId: req.user?.userId });
    if (!outcome.ok) {
      res.status(outcome.status).json({ message: outcome.message });
      return;
    }
    res.json(outcome.transaction);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

const MIN_CANCEL_REASON_WORDS = 2;
const countWords = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Customer asks to cancel their own order. The order stays active until a store manager approves. */
export const requestCancellation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { reason: bodyReason } = req.body as { reason?: unknown };
    const reason = typeof bodyReason === 'string' ? bodyReason.trim() : '';
    if (countWords(reason) < MIN_CANCEL_REASON_WORDS) {
      res.status(400).json({
        message: `Please tell the store why you want to cancel (at least ${MIN_CANCEL_REASON_WORDS} words).`,
      });
      return;
    }
    if (reason.length > 500) {
      res.status(400).json({ message: 'Reason must be 500 characters or fewer.' });
      return;
    }

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction || String(transaction.customerId) !== req.user!.userId) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }
    if (transaction.orderStatus === 'cancelled') {
      res.status(400).json({ message: 'This order is already cancelled.' });
      return;
    }
    if (transaction.claimStatus === 'claimed') {
      res.status(400).json({ message: 'This order has already been claimed and can no longer be cancelled.' });
      return;
    }
    if (transaction.cancellationRequest?.status === 'pending') {
      res.status(400).json({ message: 'A cancellation request is already waiting for the store.' });
      return;
    }

    transaction.cancellationRequest = {
      status: 'pending',
      reason,
      requestedAt: new Date(),
      resolvedAt: null,
      responseNote: null,
    };
    await transaction.save();

    const populated = await Transaction.findById(transaction._id)
      .populate('customerId', 'name email')
      .lean();

    try {
      const io = getIO();
      const storeId = String(transaction.storeId);
      io.to(`store:${storeId}`).emit('transaction:updated', populated);
      // Not written to the public activity feed (shoppers see it on the storefront), and the
      // payload carries no customer details.
      io.to(`store:${storeId}`).emit('transaction:cancel-requested', {
        transactionId: String(transaction._id),
        totalAmount: transaction.totalAmount,
      });
    } catch { /* socket broadcast is non-critical */ }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

/** Store manager approves (cancels the order) or declines a customer's cancellation request. */
export const resolveCancellationRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { decision, note } = req.body as { decision?: unknown; note?: unknown };
    if (decision !== 'approve' && decision !== 'reject') {
      res.status(400).json({ message: "decision must be 'approve' or 'reject'" });
      return;
    }

    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      res.status(404).json({ message: 'Transaction not found' });
      return;
    }
    if (transaction.cancellationRequest?.status !== 'pending') {
      res.status(400).json({ message: 'There is no pending cancellation request for this order.' });
      return;
    }

    if (decision === 'approve') {
      const outcome = await performCancellation(String(transaction._id), { userId: req.user?.userId });
      if (!outcome.ok) {
        res.status(outcome.status).json({ message: outcome.message });
        return;
      }
      res.json(outcome.transaction);
      return;
    }

    const responseNote = typeof note === 'string' && note.trim() ? note.trim().slice(0, 500) : null;
    transaction.cancellationRequest.status = 'rejected';
    transaction.cancellationRequest.resolvedAt = new Date();
    transaction.cancellationRequest.responseNote = responseNote;
    await transaction.save();

    const populated = await Transaction.findById(transaction._id)
      .populate('customerId', 'name email')
      .lean();
    try {
      getIO().to(`store:${transaction.storeId}`).emit('transaction:updated', populated);
    } catch { /* socket broadcast is non-critical */ }

    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
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
    const alreadyFulfilled = transaction.paymentStatus === 'paid' && transaction.claimStatus === 'claimed';
    const releasedReservation = transaction.orderType === 'preorder'
      && transaction.orderStatus !== 'cancelled'
      && !alreadyFulfilled
      ? await adjustReservedLines(
        items.map((item) => ({
          productId: item.productId as mongoose.Types.ObjectId,
          quantity: item.quantity,
        })),
        'release',
        session,
        { userId: req.user?.userId }
      )
      : false;

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
      if (releasedReservation || restoresStock) {
        const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
        io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
      }
      if (transaction.orderType === 'preorder') {
        await broadcastPreOrderDemand(
          storeId,
          items.map((item) => item.productId as mongoose.Types.ObjectId)
        );
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
