import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.query;
    const filter = storeId ? { storeId } : {};

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
