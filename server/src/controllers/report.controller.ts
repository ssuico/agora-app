import { Request, Response } from 'express';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.query;
    const filter: Record<string, unknown> = { paymentStatus: 'paid', orderStatus: { $ne: 'cancelled' } };
    if (storeId) filter.storeId = storeId;

    const transactions = await Transaction.find(filter);

    const totalSales = transactions.reduce((sum, t) => sum + t.totalAmount, 0);
    const totalCOGS = transactions.reduce((sum, t) => sum + t.totalCost, 0);
    const grossProfit = totalSales - totalCOGS;

    res.json({
      totalSales,
      totalCOGS,
      grossProfit,
      transactionCount: transactions.length,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getDailyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, date } = req.query;

    if (!storeId || !date) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const dayStart = new Date(date as string);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date as string);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const transactions = await Transaction.find({
      storeId,
      paymentStatus: 'paid',
      orderStatus: { $ne: 'cancelled' },
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
      };
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
      date: date as string,
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
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getInventoryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, startDate, endDate } = req.query;

    if (!storeId || !startDate || !endDate) {
      res.status(400).json({ message: 'storeId, startDate, and endDate are required' });
      return;
    }

    const start = new Date(startDate as string);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate as string);
    end.setUTCHours(23, 59, 59, 999);

    const products = await Product.find({ storeId }).lean();
    if (products.length === 0) {
      res.json({ products: [], dailyBreakdown: [] });
      return;
    }

    const productIds = products.map((p) => p._id);
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const records = await InventoryRecord.find({
      productId: { $in: productIds },
      date: { $gte: start, $lte: end },
    })
      .sort({ date: 1 })
      .lean();

    // Compute sold for each record's date per product
    const activeTxs = await Transaction.find({
      storeId,
      orderStatus: { $ne: 'cancelled' },
      createdAt: { $gte: start, $lte: end },
    })
      .select('_id createdAt')
      .lean();

    // Group transactions by date string
    const txByDate = new Map<string, string[]>();
    for (const tx of activeTxs) {
      const dStr = tx.createdAt.toISOString().slice(0, 10);
      const arr = txByDate.get(dStr) ?? [];
      arr.push(String(tx._id));
      txByDate.set(dStr, arr);
    }

    // Get all transaction items in the date range
    const allTxIds = activeTxs.map((t) => t._id);
    const txItems = await TransactionItem.find({
      transactionId: { $in: allTxIds },
      productId: { $in: productIds },
    }).lean();

    // Map: txId -> dateStr
    const txDateMap = new Map<string, string>();
    for (const tx of activeTxs) {
      txDateMap.set(String(tx._id), tx.createdAt.toISOString().slice(0, 10));
    }

    // Build sold: Map<"productId|date", number>
    const soldByKey = new Map<string, number>();
    for (const item of txItems) {
      const dStr = txDateMap.get(String(item.transactionId));
      if (!dStr) continue;
      const key = `${String(item.productId)}|${dStr}`;
      soldByKey.set(key, (soldByKey.get(key) ?? 0) + item.quantity);
    }

    // Build daily breakdown with sold + currentStock
    const dailyBreakdown = records.map((rec) => {
      const dStr = rec.date.toISOString().slice(0, 10);
      const sold = soldByKey.get(`${String(rec.productId)}|${dStr}`) ?? 0;
      const currentStock = rec.initialStock + rec.restock + rec.carryOverStock - sold;
      const product = productMap.get(String(rec.productId));

      return {
        date: dStr,
        productId: String(rec.productId),
        productName: product?.name ?? 'Unknown',
        initialStock: rec.initialStock,
        restock: rec.restock,
        carryOverStock: rec.carryOverStock,
        sold,
        currentStock: Math.max(0, currentStock),
      };
    });

    // Product-level aggregation across the date range
    const aggMap = new Map<string, {
      productName: string;
      totalInitialStock: number;
      totalRestock: number;
      totalSold: number;
      latestCurrentStock: number;
      latestDate: string;
      daysTracked: number;
    }>();

    for (const row of dailyBreakdown) {
      const existing = aggMap.get(row.productId);
      if (existing) {
        existing.totalInitialStock += row.initialStock;
        existing.totalRestock += row.restock;
        existing.totalSold += row.sold;
        existing.daysTracked += 1;
        if (row.date >= existing.latestDate) {
          existing.latestCurrentStock = row.currentStock;
          existing.latestDate = row.date;
        }
      } else {
        aggMap.set(row.productId, {
          productName: row.productName,
          totalInitialStock: row.initialStock,
          totalRestock: row.restock,
          totalSold: row.sold,
          latestCurrentStock: row.currentStock,
          latestDate: row.date,
          daysTracked: 1,
        });
      }
    }

    const productSummaries = Array.from(aggMap.entries()).map(([productId, data]) => ({
      productId,
      ...data,
    }));

    res.json({
      startDate: startDate as string,
      endDate: endDate as string,
      products: productSummaries,
      dailyBreakdown,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
