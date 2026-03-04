import { Request, Response } from 'express';
import mongoose from 'mongoose';
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

export const getDailyInventory = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const dateStr = req.query.date as string | undefined;

    if (!storeId || !dateStr) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const date = toDateOnly(dateStr);
    const dayStart = new Date(date);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const products = await Product.find({ storeId }).lean();
    if (products.length === 0) {
      res.json([]);
      return;
    }

    const productIds = products.map((p) => p._id);

    let records = await InventoryRecord.find({
      productId: { $in: productIds },
      date,
    }).lean();

    const existingProductIds = new Set(records.map((r) => String(r.productId)));
    const missingProducts = products.filter((p) => !existingProductIds.has(String(p._id)));

    if (missingProducts.length > 0) {
      const prevRecords = await InventoryRecord.aggregate([
        {
          $match: {
            productId: { $in: missingProducts.map((p) => p._id) },
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

      const prevMap = new Map(
        prevRecords.map((r) => [String(r._id), r.doc])
      );

      // Compute sold for previous-day records so we can derive carry-over
      const prevDocs = prevRecords.map((r) => r.doc);
      const prevSoldMap = await computeSoldForRecords(prevDocs);

      const newRecords = missingProducts.map((product) => {
        const pid = String(product._id);
        const prev = prevMap.get(pid);

        if (prev) {
          const prevSold = prevSoldMap.get(String(prev._id)) ?? 0;
          const prevCurrent = prev.initialStock + prev.restock + prev.carryOverStock - prevSold;
          const carryOver = product.isPerishable ? 0 : Math.max(0, prevCurrent);
          return {
            productId: product._id,
            storeId: new mongoose.Types.ObjectId(storeId),
            date,
            initialStock: carryOver,
            restock: 0,
            carryOverStock: 0,
          };
        }

        return {
          productId: product._id,
          storeId: new mongoose.Types.ObjectId(storeId),
          date,
          initialStock: product.stockQuantity,
          restock: 0,
          carryOverStock: 0,
        };
      });

      await InventoryRecord.insertMany(newRecords, { ordered: false }).catch(() => {
        // Ignore duplicate key errors from concurrent init
      });

      records = await InventoryRecord.find({
        productId: { $in: productIds },
        date,
      }).lean();
    }

    // Migrate legacy records: move carryOverStock → initialStock
    const legacyRecords = records.filter((r) => r.initialStock === 0 && r.carryOverStock > 0);
    if (legacyRecords.length > 0) {
      await Promise.all(
        legacyRecords.map((r) =>
          InventoryRecord.updateOne(
            { _id: r._id },
            { $set: { initialStock: r.carryOverStock, carryOverStock: 0 } }
          )
        )
      );
      for (const r of legacyRecords) {
        (r as any).initialStock = r.carryOverStock;
        (r as any).carryOverStock = 0;
      }
    }

    // Compute sold per product for this date
    const activeTxIds = await Transaction.find({
      storeId,
      orderStatus: { $ne: 'cancelled' },
      createdAt: { $gte: dayStart, $lte: dayEnd },
    })
      .select('_id')
      .lean();

    const txIds = activeTxIds.map((t) => t._id);

    const soldAgg = await TransactionItem.aggregate([
      { $match: { transactionId: { $in: txIds }, productId: { $in: productIds } } },
      { $group: { _id: '$productId', totalSold: { $sum: '$quantity' } } },
    ]);

    const soldMap = new Map<string, number>(
      soldAgg.map((s) => [String(s._id), s.totalSold])
    );

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

async function computeSoldForRecords(
  records: Array<{ _id: unknown; productId: unknown; date: Date; storeId: unknown }>
): Promise<Map<string, number>> {
  if (records.length === 0) return new Map();

  const result = new Map<string, number>();

  for (const rec of records) {
    const dayStart = new Date(rec.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(rec.date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const activeTxIds = await Transaction.find({
      storeId: rec.storeId,
      orderStatus: { $ne: 'cancelled' },
      createdAt: { $gte: dayStart, $lte: dayEnd },
    })
      .select('_id')
      .lean();

    const txIds = activeTxIds.map((t) => t._id);

    if (txIds.length === 0) {
      result.set(String(rec._id), 0);
      continue;
    }

    const soldAgg = await TransactionItem.aggregate([
      {
        $match: {
          transactionId: { $in: txIds },
          productId: rec.productId,
        },
      },
      { $group: { _id: null, totalSold: { $sum: '$quantity' } } },
    ]);

    result.set(String(rec._id), soldAgg[0]?.totalSold ?? 0);
  }

  return result;
}

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

    const io = getIO();
    const updatedProducts = await Product.find({ storeId }).lean();
    io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);

    res.json(record);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
