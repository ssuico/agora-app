import { Request, Response } from 'express';
import { localDayRange, localDayRangeFromDateString } from '../config/timezone.js';
import { Expense } from '../models/Expense.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';

/** Parse date string to UTC midnight (for InventoryRecord queries). */
function toDateOnly(input: string | Date): Date {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Same filters as getSummary so daily report shows the same "sold" definition. */
const REPORT_TX_FILTER = { paymentStatus: 'paid' as const, orderStatus: { $ne: 'cancelled' as const } };
const toSafeNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.query;
    const filter: Record<string, unknown> = { ...REPORT_TX_FILTER };
    const normalizedStoreId = typeof storeId === 'string' && storeId.trim() ? storeId : null;
    if (normalizedStoreId) filter.storeId = normalizedStoreId;

    const expenseFilter: Record<string, unknown> = {};
    if (normalizedStoreId) expenseFilter.storeId = normalizedStoreId;

    const [transactions, expenses] = await Promise.all([
      Transaction.find(filter),
      Expense.find(expenseFilter).select('amount').lean(),
    ]);

    const totalSales = transactions.reduce((sum, t) => sum + toSafeNumber(t.totalAmount), 0);
    const totalCOGS = transactions.reduce((sum, t) => sum + toSafeNumber(t.totalCost), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + toSafeNumber(e.amount), 0);
    const grossProfit = totalSales - totalCOGS;
    const netProfit = grossProfit - totalExpenses;

    res.json({
      totalSales,
      totalCOGS,
      grossProfit,
      totalExpenses,
      netProfit,
      remainingCapital: 0,
      transactionCount: transactions.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ message: 'Server error', error: message });
  }
};

export const getDailyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, date } = req.query;

    if (!storeId || !date) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const dateStr = String(date).trim();
    let dayStart: Date;
    let dayEnd: Date;
    try {
      const range = localDayRangeFromDateString(dateStr);
      dayStart = range.dayStart;
      dayEnd = range.dayEnd;
    } catch {
      const dateObj = toDateOnly(dateStr);
      const range = localDayRange(dateObj);
      dayStart = range.dayStart;
      dayEnd = range.dayEnd;
    }

    const transactions = await Transaction.find({
      storeId,
      ...REPORT_TX_FILTER,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    });

    const txIds = transactions.map((t) => t._id);

    const [items, products] = await Promise.all([
      TransactionItem.find({ transactionId: { $in: txIds } }).populate(
        'productId',
        'name sellingPrice costPrice'
      ),
      Product.find({ storeId }).select('name stockQuantity sellingPrice costPrice'),
    ]);

    const soldMap = new Map<
      string,
      { name: string; unitsSold: number; revenue: number; cost: number }
    >();

    for (const item of items) {
      const product = item.productId as unknown as {
        _id: string;
        name: string;
        sellingPrice: number;
        costPrice: number;
      } | null;
      if (!product) continue;
      const id = String(product._id);
      const existing = soldMap.get(id);
      if (existing) {
        existing.unitsSold += item.quantity;
        existing.revenue += item.subtotal;
        existing.cost += item.costSubtotal;
      } else {
        soldMap.set(id, {
          name: product.name,
          unitsSold: item.quantity,
          revenue: item.subtotal,
          cost: item.costSubtotal,
        });
      }
    }

    const soldItems = Array.from(soldMap.entries()).map(([productId, data]) => ({
      productId,
      ...data,
      profit: data.revenue - data.cost,
    }));

    const totalUnitsSold = soldItems.reduce((sum, i) => sum + i.unitsSold, 0);
    const totalRevenue = soldItems.reduce((sum, i) => sum + i.revenue, 0);
    const totalCost = soldItems.reduce((sum, i) => sum + i.cost, 0);
    const totalProfit = totalRevenue - totalCost;

    const inventory = products.map((p) => ({
      productId: String(p._id),
      name: p.name,
      stockQuantity: p.stockQuantity,
      sellingPrice: p.sellingPrice,
      costPrice: p.costPrice,
    }));

    res.json({
      date: dateStr,
      transactionCount: transactions.length,
      soldItems,
      totals: {
        unitsSold: totalUnitsSold,
        revenue: totalRevenue,
        cost: totalCost,
        profit: totalProfit,
      },
      inventory,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ message: 'Server error', error: message });
  }
};

export const getInventoryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, date } = req.query;

    if (!storeId || !date) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const dateStr = String(date).trim();
    const dateObj = toDateOnly(dateStr);

    const products = await Product.find({ storeId }).lean();
    if (products.length === 0) {
      res.json({ date: dateStr, products: [] });
      return;
    }

    const productIds = products.map((p) => p._id);
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const records = await InventoryRecord.find({
      productId: { $in: productIds },
      date: dateObj,
    }).lean();

    const { dayStart, dayEnd } = localDayRange(dateObj);

    const activeTxs = await Transaction.find({
      storeId,
      orderStatus: { $ne: 'cancelled' },
      createdAt: { $gte: dayStart, $lte: dayEnd },
    })
      .select('_id')
      .lean();

    const txIds = activeTxs.map((t) => t._id);

    const soldAgg = txIds.length > 0
      ? await TransactionItem.aggregate([
          { $match: { transactionId: { $in: txIds }, productId: { $in: productIds } } },
          { $group: { _id: '$productId', totalSold: { $sum: '$quantity' } } },
        ])
      : [];

    const soldMap = new Map<string, number>(
      soldAgg.map((s: { _id: unknown; totalSold: number }) => [String(s._id), s.totalSold])
    );

    const reportProducts = records.map((rec) => {
      const product = productMap.get(String(rec.productId));
      const sold = soldMap.get(String(rec.productId)) ?? 0;
      const displayInitialStock = rec.initialStock + rec.restock;
      const currentStock = Math.max(0, displayInitialStock - sold);

      return {
        productId: String(rec.productId),
        productName: product?.name ?? 'Unknown',
        isPerishable: product?.isPerishable ?? false,
        costPrice: product?.costPrice ?? 0,
        sellingPrice: product?.sellingPrice ?? 0,
        discountPrice: product?.discountPrice ?? null,
        sellerName: product?.sellerName ?? '',
        notes: product?.notes ?? '',
        initialStock: rec.initialStock,
        restock: rec.restock,
        displayInitialStock,
        sold,
        currentStock,
      };
    });

    res.json({
      date: dateStr,
      products: reportProducts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ message: 'Server error', error: message });
  }
};
