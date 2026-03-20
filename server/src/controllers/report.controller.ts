import { Request, Response } from 'express';
import { localDayRange, localDayRangeFromDateString, toLocalDateStr } from '../config/timezone.js';
import { Expense } from '../models/Expense.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product } from '../models/Product.js';
import { Rating } from '../models/Rating.js';
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

// ---------------------------------------------------------------------------
// GET /api/reports/dashboard-analytics
// Returns pre-aggregated data for all dashboard charts in a single call.
// Query: storeId (required), days (default 30)
// ---------------------------------------------------------------------------

export const getDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, days: daysParam = '30' } = req.query as Record<string, string>;
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const days = Math.min(parseInt(daysParam, 10) || 30, 90);
    const now = new Date();
    const todayStr = toLocalDateStr(now);
    const todayRange = localDayRangeFromDateString(todayStr);

    const startDate = new Date(todayRange.dayStart);
    startDate.setDate(startDate.getDate() - (days - 1));

    // --- Parallel data fetching ---
    const [
      transactions,
      allProducts,
      inventoryRecords,
      ratings,
      expenses,
    ] = await Promise.all([
      Transaction.find({
        storeId,
        ...REPORT_TX_FILTER,
        createdAt: { $gte: startDate, $lte: todayRange.dayEnd },
      }).lean(),
      Product.find({ storeId }).lean(),
      InventoryRecord.find({
        storeId,
        date: { $gte: toDateOnly(startDate.toISOString()) },
      }).lean(),
      Rating.find({ storeId }).lean(),
      Expense.find({
        storeId,
        date: { $gte: startDate },
      }).lean(),
    ]);

    // --- 1. Sales time series (daily revenue/cost/profit/txCount) ---
    const salesByDay = new Map<string, { revenue: number; cost: number; profit: number; transactions: number; unitsSold: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(todayRange.dayStart);
      d.setDate(d.getDate() - i);
      const key = toLocalDateStr(d);
      salesByDay.set(key, { revenue: 0, cost: 0, profit: 0, transactions: 0, unitsSold: 0 });
    }

    const txIds = transactions.map((t) => t._id);
    const txItems = txIds.length > 0
      ? await TransactionItem.find({ transactionId: { $in: txIds } }).lean()
      : [];

    const txItemsByTx = new Map<string, typeof txItems>();
    for (const item of txItems) {
      const key = String(item.transactionId);
      const arr = txItemsByTx.get(key) ?? [];
      arr.push(item);
      txItemsByTx.set(key, arr);
    }

    for (const tx of transactions) {
      const dayKey = toLocalDateStr(new Date(tx.createdAt));
      const bucket = salesByDay.get(dayKey);
      if (!bucket) continue;
      bucket.revenue += toSafeNumber(tx.totalAmount);
      bucket.cost += toSafeNumber(tx.totalCost);
      bucket.profit += toSafeNumber(tx.grossProfit);
      bucket.transactions += 1;
      const items = txItemsByTx.get(String(tx._id)) ?? [];
      bucket.unitsSold += items.reduce((s, i) => s + i.quantity, 0);
    }

    const salesTimeSeries = Array.from(salesByDay.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- 2. Revenue per product (all-time within range) ---
    const productRevenueMap = new Map<string, { name: string; revenue: number; cost: number; unitsSold: number }>();
    const productMap = new Map(allProducts.map((p) => [String(p._id), p]));

    for (const item of txItems) {
      const pid = String(item.productId);
      const prod = productMap.get(pid);
      const existing = productRevenueMap.get(pid);
      if (existing) {
        existing.revenue += toSafeNumber(item.subtotal);
        existing.cost += toSafeNumber(item.costSubtotal);
        existing.unitsSold += item.quantity;
      } else {
        productRevenueMap.set(pid, {
          name: prod?.name ?? 'Unknown',
          revenue: toSafeNumber(item.subtotal),
          cost: toSafeNumber(item.costSubtotal),
          unitsSold: item.quantity,
        });
      }
    }

    const revenueByProduct = Array.from(productRevenueMap.entries())
      .map(([productId, data]) => ({
        productId,
        ...data,
        profit: data.revenue - data.cost,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // --- 3. Inventory snapshot ---
    const inventorySnapshot = allProducts.map((p) => ({
      productId: String(p._id),
      name: p.name,
      stockQuantity: p.stockQuantity,
      isPerishable: p.isPerishable ?? false,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
    }));

    const perishableCount = inventorySnapshot.filter((p) => p.isPerishable).length;
    const lowStockCount = inventorySnapshot.filter((p) => p.stockQuantity > 0 && p.stockQuantity < 10).length;
    const outOfStockCount = inventorySnapshot.filter((p) => p.stockQuantity === 0).length;
    const totalInventoryItems = inventorySnapshot.reduce((s, p) => s + p.stockQuantity, 0);

    // --- 4. Restock trends ---
    const restockByDay = new Map<string, number>();
    for (const rec of inventoryRecords) {
      if (rec.restock > 0) {
        const dateKey = rec.date.toISOString().slice(0, 10);
        restockByDay.set(dateKey, (restockByDay.get(dateKey) ?? 0) + rec.restock);
      }
    }
    const restockTimeSeries = Array.from(restockByDay.entries())
      .map(([date, units]) => ({ date, units }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- 5. Customer reservation activity (daily tx count including all statuses) ---
    const allReservations = await Transaction.find({
      storeId,
      orderStatus: { $ne: 'cancelled' },
      createdAt: { $gte: startDate, $lte: todayRange.dayEnd },
    }).select('createdAt').lean();

    const reservationsByDay = new Map<string, number>();
    for (const r of allReservations) {
      const key = toLocalDateStr(new Date(r.createdAt));
      reservationsByDay.set(key, (reservationsByDay.get(key) ?? 0) + 1);
    }
    const reservationTimeSeries = Array.from(salesByDay.keys())
      .map((date) => ({ date, count: reservationsByDay.get(date) ?? 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // --- 6. Rating distribution ---
    const ratingDistribution = [0, 0, 0, 0, 0]; // index 0 = 1 star ... index 4 = 5 stars
    let totalStoreRatings = 0;
    let sumStoreStars = 0;
    let totalProductRatings = 0;
    let sumProductStars = 0;

    for (const r of ratings) {
      const idx = Math.max(0, Math.min(4, r.stars - 1));
      ratingDistribution[idx]++;
      if (r.type === 'store') {
        totalStoreRatings++;
        sumStoreStars += r.stars;
      } else {
        totalProductRatings++;
        sumProductStars += r.stars;
      }
    }

    // Per-product ratings
    const productRatingsMap = new Map<string, { stars: number; count: number }>();
    for (const r of ratings) {
      if (r.type === 'product' && r.productId) {
        const pid = String(r.productId);
        const existing = productRatingsMap.get(pid);
        if (existing) {
          existing.stars += r.stars;
          existing.count++;
        } else {
          productRatingsMap.set(pid, { stars: r.stars, count: 1 });
        }
      }
    }

    const productPerformance = allProducts.map((p) => {
      const pid = String(p._id);
      const revData = productRevenueMap.get(pid);
      const ratingData = productRatingsMap.get(pid);
      return {
        productId: pid,
        name: p.name,
        revenue: revData?.revenue ?? 0,
        unitsSold: revData?.unitsSold ?? 0,
        profit: (revData?.revenue ?? 0) - (revData?.cost ?? 0),
        avgRating: ratingData ? ratingData.stars / ratingData.count : 0,
        ratingCount: ratingData?.count ?? 0,
        stockQuantity: p.stockQuantity,
      };
    });

    // --- 7. KPI tiles ---
    const todaySales = salesByDay.get(todayStr);
    const weekStart = new Date(todayRange.dayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekKeys = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      weekKeys.push(toLocalDateStr(d));
    }
    const weekRevenue = weekKeys.reduce((s, k) => s + (salesByDay.get(k)?.revenue ?? 0), 0);
    const weekTransactions = weekKeys.reduce((s, k) => s + (salesByDay.get(k)?.transactions ?? 0), 0);

    const monthKeys = Array.from(salesByDay.keys());
    const monthRevenue = monthKeys.reduce((s, k) => s + (salesByDay.get(k)?.revenue ?? 0), 0);
    const monthTransactions = monthKeys.reduce((s, k) => s + (salesByDay.get(k)?.transactions ?? 0), 0);

    const avgOrderValue = transactions.length > 0
      ? transactions.reduce((s, t) => s + toSafeNumber(t.totalAmount), 0) / transactions.length
      : 0;

    const topProductBySold = revenueByProduct.length > 0
      ? [...revenueByProduct].sort((a, b) => b.unitsSold - a.unitsSold)[0]
      : null;

    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const reservationsLast24h = allReservations.filter(
      (r) => new Date(r.createdAt).getTime() >= last24h.getTime()
    ).length;

    const totalExpenseAmount = expenses.reduce((s, e) => s + toSafeNumber(e.amount), 0);

    res.json({
      kpis: {
        todayRevenue: todaySales?.revenue ?? 0,
        todayTransactions: todaySales?.transactions ?? 0,
        todayUnitsSold: todaySales?.unitsSold ?? 0,
        weekRevenue,
        weekTransactions,
        monthRevenue,
        monthTransactions,
        avgOrderValue,
        totalExpenses: totalExpenseAmount,
        topProduct: topProductBySold ? { name: topProductBySold.name, unitsSold: topProductBySold.unitsSold } : null,
        reservationsLast24h,
        totalInventoryItems,
        lowStockCount,
        outOfStockCount,
        perishableCount,
        avgStoreRating: totalStoreRatings > 0 ? sumStoreStars / totalStoreRatings : 0,
        totalStoreRatings,
        avgProductRating: totalProductRatings > 0 ? sumProductStars / totalProductRatings : 0,
        totalProductRatings,
      },
      salesTimeSeries,
      revenueByProduct: revenueByProduct.slice(0, 20),
      inventorySnapshot: inventorySnapshot.sort((a, b) => a.stockQuantity - b.stockQuantity),
      restockTimeSeries,
      reservationTimeSeries,
      ratingDistribution,
      productPerformance: productPerformance.filter((p) => p.revenue > 0 || p.ratingCount > 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ message: 'Server error', error: message });
  }
};
