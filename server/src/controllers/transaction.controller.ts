import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Transaction, type ClaimStatus, type PaymentStatus } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
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

    let totalAmount = 0;
    let totalCost = 0;

    const resolvedItems: Array<{
      productId: mongoose.Types.ObjectId;
      quantity: number;
      subtotal: number;
      costSubtotal: number;
    }> = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).session(session);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      if (product.stockQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}" (available: ${product.stockQuantity})`
        );
      }

      const subtotal = product.sellingPrice * item.quantity;
      const costSubtotal = product.costPrice * item.quantity;

      totalAmount += subtotal;
      totalCost += costSubtotal;

      product.stockQuantity -= item.quantity;
      await product.save({ session });

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
    const paymentStatus =
      isStaff && body.paymentStatus && ['unpaid', 'paid'].includes(body.paymentStatus)
        ? body.paymentStatus
        : 'unpaid';

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
      }],
      { session }
    );

    const txItems = resolvedItems.map((i) => ({ ...i, transactionId: transaction._id }));
    await TransactionItem.insertMany(txItems, { session });

    await session.commitTransaction();

    try {
      const io = getIO();
      const updatedProducts = await Product.find({ storeId }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);

      const populatedTx = await Transaction.findById(transaction._id)
        .populate('customerId', 'name email')
        .lean();
      io.to(`store:${storeId}`).emit('transaction:created', populatedTx);
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
    const { storeId, claimStatus, paymentStatus, orderStatus, customerName, productId, dateFrom, dateTo } = req.query;
    const filter: Record<string, unknown> = {};
    if (storeId) filter.storeId = storeId;
    if (claimStatus && claimStatus !== 'all') filter.claimStatus = claimStatus;
    if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
    if (orderStatus && orderStatus !== 'all') {
      filter.orderStatus = orderStatus;
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
    const { claimStatus, paymentStatus } = req.body;
    const update: Record<string, string> = {};

    if (claimStatus && ['unclaimed', 'claimed'].includes(claimStatus)) {
      update.claimStatus = claimStatus;
    }
    if (paymentStatus && ['unpaid', 'paid'].includes(paymentStatus)) {
      update.paymentStatus = paymentStatus;
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

    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { stockQuantity: item.quantity } },
        { session }
      );
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
      const updatedProducts = await Product.find({ storeId }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
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

    if (transaction.orderStatus !== 'cancelled') {
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
      const updatedProducts = await Product.find({ storeId }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
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
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
