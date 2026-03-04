import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { localDayRange } from '../config/timezone.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { getIO } from '../socket.js';

function toDateOnly(input: string | Date): Date {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayUTC(): Date {
  return toDateOnly(new Date());
}

async function computeSoldMap(
  storeId: string | mongoose.Types.ObjectId,
  date: Date,
  productIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  const { dayStart, dayEnd } = localDayRange(date);

  const activeTxIds = await Transaction.find({
    storeId,
    orderStatus: { $ne: 'cancelled' },
    createdAt: { $gte: dayStart, $lte: dayEnd },
  })
    .select('_id')
    .lean();

  const txIds = activeTxIds.map((t) => t._id);
  if (txIds.length === 0) return new Map();

  const soldAgg = await TransactionItem.aggregate([
    { $match: { transactionId: { $in: txIds }, productId: { $in: productIds } } },
    { $group: { _id: '$productId', totalSold: { $sum: '$quantity' } } },
  ]);

  return new Map<string, number>(
    soldAgg.map((s) => [String(s._id), s.totalSold])
  );
}

export const getDailyInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const dateStr = req.query.date as string | undefined;

    if (!storeId || !dateStr) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const date = toDateOnly(dateStr);

    const products = await Product.find({ storeId }).lean();
    if (products.length === 0) {
      res.json([]);
      return;
    }

    const productIds = products.map((p) => p._id);

    // --- Derive expected initialStock for every product from the previous day ---
    const prevRecords = await InventoryRecord.aggregate([
      {
        $match: {
          productId: { $in: productIds },
          date: { $lt: date },
        },
      },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: '$productId',
          doc: { $first: '$$ROOT' },
        },
      },
    ]);

    const prevMap = new Map<string, any>(
      prevRecords.map((r) => [String(r._id), r.doc])
    );

    // Compute sold for each previous-day record's date + store
    const prevSoldMaps = new Map<string, number>();
    for (const r of prevRecords) {
      const doc = r.doc;
      const prevProductIds = [doc.productId];
      const sold = await computeSoldMap(doc.storeId, doc.date, prevProductIds);
      prevSoldMaps.set(String(r._id), sold.get(String(doc.productId)) ?? 0);
    }

    // --- Compute sold for current date early (needed for correct initialStock) ---
    const soldMap = await computeSoldMap(storeId, date, productIds);

    // --- Ensure records exist and initialStock is correct ---
    let records = await InventoryRecord.find({
      productId: { $in: productIds },
      date,
    }).lean();

    const existingMap = new Map(records.map((r) => [String(r.productId), r]));

    // Build expected initialStock for each product
    const expectedInitial = new Map<string, number>();
    for (const product of products) {
      const pid = String(product._id);
      const prev = prevMap.get(pid);

      if (prev) {
        const prevSold = prevSoldMaps.get(pid) ?? 0;
        const prevCurrent = prev.initialStock + prev.restock + prev.carryOverStock - prevSold;
        const carryOver = product.isPerishable ? 0 : Math.max(0, prevCurrent);
        expectedInitial.set(pid, carryOver);
      } else {
        // product.stockQuantity is a live value already decremented by today's
        // transactions and incremented by today's restocks. Reverse those changes
        // to recover the true start-of-day stock.
        const todaySold = soldMap.get(pid) ?? 0;
        const todayRestock = existingMap.get(pid)?.restock ?? 0;
        expectedInitial.set(pid, product.stockQuantity + todaySold - todayRestock);
      }
    }

    // Create missing records
    const missingProducts = products.filter((p) => !existingMap.has(String(p._id)));
    if (missingProducts.length > 0) {
      const newRecords = missingProducts.map((product) => ({
        productId: product._id,
        storeId: new mongoose.Types.ObjectId(storeId),
        date,
        initialStock: expectedInitial.get(String(product._id)) ?? 0,
        restock: 0,
        carryOverStock: 0,
      }));

      await InventoryRecord.insertMany(newRecords, { ordered: false }).catch(() => {});
    }

    // Fix existing records whose initialStock is stale
    const updates: Promise<any>[] = [];
    for (const [pid, existing] of existingMap) {
      const expected = expectedInitial.get(pid) ?? 0;
      const actualInitial = existing.initialStock + existing.carryOverStock;
      if (actualInitial !== expected) {
        updates.push(
          InventoryRecord.updateOne(
            { _id: existing._id },
            { $set: { initialStock: expected, carryOverStock: 0 } }
          )
        );
      }
    }
    if (updates.length > 0) await Promise.all(updates);

    // Refetch if anything changed
    if (missingProducts.length > 0 || updates.length > 0) {
      records = await InventoryRecord.find({
        productId: { $in: productIds },
        date,
      }).lean();
    }
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const result = records.map((rec) => {
      const product = productMap.get(String(rec.productId));
      const sold = soldMap.get(String(rec.productId)) ?? 0;
      const currentStock = rec.initialStock + rec.restock + rec.carryOverStock - sold;

      return {
        _id: rec._id,
        productId: String(rec.productId),
        productName: product?.name ?? 'Unknown',
        images: product?.images ?? [],
        costPrice: product?.costPrice ?? 0,
        sellingPrice: product?.sellingPrice ?? 0,
        isPerishable: product?.isPerishable ?? false,
        initialStock: rec.initialStock,
        restock: rec.restock,
        carryOverStock: rec.carryOverStock,
        sold,
        currentStock: Math.max(0, currentStock),
        date: rec.date,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const restockProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { quantity, storeId, date: dateStr } = req.body as { quantity: number; storeId: string; date?: string };

    if (!quantity || quantity <= 0) {
      res.status(400).json({ message: 'quantity must be a positive number' });
      return;
    }

    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const targetDate = dateStr ? toDateOnly(dateStr) : todayUTC();
    const today = todayUTC();

    if (targetDate < today) {
      res.status(400).json({ message: 'Cannot restock for a past date' });
      return;
    }

    const record = await InventoryRecord.findOneAndUpdate(
      { productId, date: targetDate },
      { $inc: { restock: quantity } },
      { new: true, upsert: false }
    );

    if (!record) {
      res.status(404).json({ message: 'No inventory record for this date. Open the products tab first to initialize daily records.' });
      return;
    }

    await Product.findByIdAndUpdate(productId, { $inc: { stockQuantity: quantity } });

    try {
      const io = getIO();
      const updatedProducts = await Product.find({ storeId }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
    } catch { /* socket broadcast is non-critical */ }

    res.json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[restockProduct]', message);
    res.status(500).json({ message });
  }
};
