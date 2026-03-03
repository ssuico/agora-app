import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { UserRole } from '../types/index.js';

interface CartItem {
  productId: string;
  quantity: number;
}

export const createTransaction = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { storeId, items } = req.body as { storeId: string; items: CartItem[] };

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

    const customerId =
      req.user!.role === UserRole.CUSTOMER ? req.user!.userId : undefined;

    const [transaction] = await Transaction.create(
      [{ storeId, totalAmount, totalCost, grossProfit, customerId }],
      { session }
    );

    const txItems = resolvedItems.map((i) => ({ ...i, transactionId: transaction._id }));
    await TransactionItem.insertMany(txItems, { session });

    await session.commitTransaction();
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
    const { storeId } = req.query;
    const filter = storeId ? { storeId } : {};
    const transactions = await Transaction.find(filter)
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 });
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
