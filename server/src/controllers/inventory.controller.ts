import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { localDayRange, toLocalDateStr } from '../config/timezone.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product } from '../models/Product.js';
import { StoreClosing } from '../models/StoreClosing.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { getIO } from '../socket.js';

function toDateOnly(input: string | Date): Date {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function todayInAppTz(): Date {
  return toDateOnly(toLocalDateStr(new Date()));
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

// ---------------------------------------------------------------------------
// GET /api/inventory/daily
// ---------------------------------------------------------------------------

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

    let records = await InventoryRecord.find({
      productId: { $in: productIds },
      date,
    }).lean();

    const existingMap = new Map(records.map((r) => [String(r.productId), r]));

    // Auto-create records only for products that have never had an inventory
    // record (brand-new products). Subsequent-day records are created by the
    // Store Closing workflow.
    const brandNewProducts = [];
    for (const product of products) {
      const pid = String(product._id);
      if (existingMap.has(pid)) continue;

      const anyPrev = await InventoryRecord.exists({ productId: product._id });
      if (!anyPrev) {
        brandNewProducts.push(product);
      }
    }

    if (brandNewProducts.length > 0) {
      const newRecords = brandNewProducts.map((product) => ({
        productId: product._id,
        storeId: new mongoose.Types.ObjectId(storeId),
        date,
        initialStock: product.stockQuantity,
        restock: 0,
      }));

      await InventoryRecord.insertMany(newRecords, { ordered: false }).catch(() => {});

      records = await InventoryRecord.find({
        productId: { $in: productIds },
        date,
      }).lean();
    }

    const soldMap = await computeSoldMap(storeId, date, productIds);
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const result = records.map((rec) => {
      const product = productMap.get(String(rec.productId));
      const sold = soldMap.get(String(rec.productId)) ?? 0;
      const displayInitialStock = rec.initialStock + rec.restock;
      const currentStock = displayInitialStock - sold;

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
        sold,
        displayInitialStock,
        currentStock: Math.max(0, currentStock),
        date: rec.date,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/inventory/daily/:productId/restock
// ---------------------------------------------------------------------------

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

    const targetDate = dateStr ? toDateOnly(dateStr) : todayInAppTz();
    const today = todayInAppTz();

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
      res.status(404).json({ message: 'No inventory record for this date. Open the inventory tab first to initialize daily records.' });
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

// ---------------------------------------------------------------------------
// POST /api/inventory/daily/close-store
// ---------------------------------------------------------------------------

export const closeStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, date: dateStr, selections } = req.body as {
      storeId: string;
      date: string;
      selections: Array<{ productId: string; carryOver: boolean }>;
    };

    if (!storeId || !dateStr || !selections) {
      res.status(400).json({ message: 'storeId, date, and selections are required' });
      return;
    }

    const date = toDateOnly(dateStr);

    const products = await Product.find({ storeId }).lean();
    if (products.length === 0) {
      res.status(400).json({ message: 'No products found for this store' });
      return;
    }

    const productIds = products.map((p) => p._id);

    // Fetch today's records and compute sold to derive current stock
    const records = await InventoryRecord.find({
      productId: { $in: productIds },
      date,
    }).lean();

    const soldMap = await computeSoldMap(storeId, date, productIds);

    const recordMap = new Map(records.map((r) => [String(r.productId), r]));
    const selectionMap = new Map(selections.map((s) => [s.productId, s.carryOver]));

    // Build carry-over selections with current stock snapshots
    const carryOverSelections = products.map((product) => {
      const pid = String(product._id);
      const rec = recordMap.get(pid);
      const sold = soldMap.get(pid) ?? 0;
      const currentStock = rec
        ? Math.max(0, rec.initialStock + rec.restock - sold)
        : Math.max(0, product.stockQuantity);

      return {
        productId: product._id,
        carryOver: selectionMap.get(pid) ?? !product.isPerishable,
        currentStock,
      };
    });

    // Upsert the StoreClosing record
    const closing = await StoreClosing.findOneAndUpdate(
      { storeId, date },
      {
        storeId,
        date,
        closedBy: req.user!.userId,
        closedAt: new Date(),
        carryOverSelections,
      },
      { upsert: true, new: true }
    );

    // Create / update next-day InventoryRecords only for products with stock
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

    const carried = carryOverSelections.filter(
      (sel) => sel.carryOver && sel.currentStock > 0
    );

    const bulkOps = carried.map((sel) => ({
      updateOne: {
        filter: { productId: sel.productId, date: nextDay },
        update: {
          $set: {
            storeId: new mongoose.Types.ObjectId(storeId),
            initialStock: sel.currentStock,
          },
          $setOnInsert: { restock: 0 },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await InventoryRecord.bulkWrite(bulkOps);
    }

    res.json(closing);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[closeStore]', message);
    res.status(500).json({ message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/inventory/daily/reopen-store
// ---------------------------------------------------------------------------

export const reopenStore = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, date: dateStr } = req.body as { storeId: string; date: string };

    if (!storeId || !dateStr) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const date = toDateOnly(dateStr);

    const closing = await StoreClosing.findOne({ storeId, date }).lean();
    if (!closing) {
      res.status(404).json({ message: 'No closing record found for this date' });
      return;
    }

    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const productIds = closing.carryOverSelections.map((s) => s.productId);

    // Remove next-day records that were created by the close, but only if they
    // have no restocks (restock === 0) — otherwise they've been modified and
    // should be kept.
    await InventoryRecord.deleteMany({
      productId: { $in: productIds },
      date: nextDay,
      restock: 0,
    });

    await StoreClosing.deleteOne({ _id: closing._id });

    res.json({ message: 'Store reopened' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[reopenStore]', message);
    res.status(500).json({ message });
  }
};

// ---------------------------------------------------------------------------
// GET /api/inventory/daily/close-status
// ---------------------------------------------------------------------------

export const getStoreClosingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const dateStr = req.query.date as string | undefined;

    if (!storeId || !dateStr) {
      res.status(400).json({ message: 'storeId and date are required' });
      return;
    }

    const date = toDateOnly(dateStr);
    const closing = await StoreClosing.findOne({ storeId, date }).lean();

    res.json(closing ?? null);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
