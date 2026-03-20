import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { localDayRange, toLocalDateStr } from '../config/timezone.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product } from '../models/Product.js';
import { Store } from '../models/Store.js';
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

    // Fetch today's records and compute sold counts in parallel
    let [records, soldMap] = await Promise.all([
      InventoryRecord.find({ productId: { $in: productIds }, date }).lean(),
      computeSoldMap(storeId, date, productIds),
    ]);

    const existingMap = new Map(records.map((r) => [String(r.productId), r]));

    // Find products missing from today's records
    const missingProducts = products.filter((p) => !existingMap.has(String(p._id)));

    if (missingProducts.length > 0) {
      // Batch check: find which missing products have ANY prior inventory record.
      // This replaces the old N+1 loop of individual `.exists()` calls.
      const missingIds = missingProducts.map((p) => p._id);
      const withHistory = await InventoryRecord.distinct('productId', {
        productId: { $in: missingIds },
      });
      const hasHistorySet = new Set(withHistory.map(String));

      const brandNewProducts = missingProducts.filter(
        (p) => !hasHistorySet.has(String(p._id))
      );

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
    }

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    const result = records.map((rec) => {
      const product = productMap.get(String(rec.productId));
      const sold = soldMap.get(String(rec.productId)) ?? 0;
      const reduction = (rec as { reduction?: number }).reduction ?? 0;
      const displayInitialStock = Math.max(0, rec.initialStock + rec.restock - reduction);

      return {
        _id: rec._id,
        productId: String(rec.productId),
        productName: product?.name ?? 'Unknown',
        images: product?.images ?? [],
        costPrice: product?.costPrice ?? 0,
        sellingPrice: product?.sellingPrice ?? 0,
        isPerishable: product?.isPerishable ?? false,
        sellerName: product?.sellerName ?? '',
        notes: product?.notes ?? '',
        initialStock: rec.initialStock,
        restock: rec.restock,
        reduction,
        sold,
        displayInitialStock,
        currentStock: Math.max(0, displayInitialStock - sold),
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
// PATCH /api/inventory/daily/:productId/reduce
// ---------------------------------------------------------------------------

export const reduceStock = async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ message: 'Cannot reduce stock for a past date' });
      return;
    }

    const product = await Product.findById(productId).lean();
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const currentStock = product.stockQuantity ?? 0;
    const actualReduce = Math.min(quantity, Math.max(0, currentStock));
    if (actualReduce <= 0) {
      res.status(400).json({ message: 'No stock available to reduce' });
      return;
    }

    const record = await InventoryRecord.findOneAndUpdate(
      { productId, date: targetDate },
      { $inc: { reduction: actualReduce } },
      { new: true, upsert: false }
    );

    if (!record) {
      res.status(404).json({
        message: 'No inventory record for this date. Open the inventory tab first to initialize daily records.',
      });
      return;
    }

    await Product.findByIdAndUpdate(productId, { $inc: { stockQuantity: -actualReduce } });

    try {
      const io = getIO();
      const updatedProducts = await Product.find({ storeId }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
    } catch { /* socket broadcast is non-critical */ }

    res.json({ record, reduced: actualReduce });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[reduceStock]', message);
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

    // Build carry-over selections — only for products that have an inventory
    // record for the closing date. Products without a record were never part
    // of this day's inventory and must not be carried forward.
    const carryOverSelections = products
      .filter((product) => recordMap.has(String(product._id)))
      .map((product) => {
        const pid = String(product._id);
        const rec = recordMap.get(pid)!;
        const sold = soldMap.get(pid) ?? 0;
        const reduction = (rec as { reduction?: number }).reduction ?? 0;
        const currentStock = Math.max(0, rec.initialStock + rec.restock - reduction - sold);

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

    // Create / update next-day InventoryRecords based solely on the manager's
    // carry-over selection — quantity (including 0) does not affect eligibility.
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

    const carried = carryOverSelections.filter((sel) => sel.carryOver);
    const notCarried = carryOverSelections.filter((sel) => !sel.carryOver);

    // Remove next-day records for unchecked items (only if they haven't been
    // modified with restocks — same guard as reopen).
    if (notCarried.length > 0) {
      await InventoryRecord.deleteMany({
        productId: { $in: notCarried.map((s) => s.productId) },
        date: nextDay,
        restock: 0,
      });
    }

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

    await Store.findByIdAndUpdate(storeId, { isOpen: false });

    try {
      const io = getIO();
      io.to(`store:${storeId}`).emit('store:status-changed', { storeId, isOpen: false });
    } catch { /* socket broadcast is non-critical */ }

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

    await Store.findByIdAndUpdate(storeId, { isOpen: true });

    try {
      const io = getIO();
      io.to(`store:${storeId}`).emit('store:status-changed', { storeId, isOpen: true });
    } catch { /* socket broadcast is non-critical */ }

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

// ---------------------------------------------------------------------------
// GET /api/inventory/listing-history
// Returns products that have been listed before but are NOT in today's inventory.
// ---------------------------------------------------------------------------

export const getListingHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const today = todayInAppTz();

    const products = await Product.find({ storeId }).lean();
    if (products.length === 0) {
      res.json([]);
      return;
    }

    const productIds = products.map((p) => p._id);

    const todayRecords = await InventoryRecord.find({
      productId: { $in: productIds },
      date: today,
    })
      .select('productId')
      .lean();

    const activeToday = new Set(todayRecords.map((r) => String(r.productId)));

    const inactiveProducts = products.filter(
      (p) => !activeToday.has(String(p._id))
    );

    if (inactiveProducts.length === 0) {
      res.json([]);
      return;
    }

    const inactiveIds = inactiveProducts.map((p) => p._id);

    const [lastListedAgg, timesListedAgg] = await Promise.all([
      InventoryRecord.aggregate([
        { $match: { productId: { $in: inactiveIds } } },
        { $group: { _id: '$productId', lastDate: { $max: '$date' } } },
      ]),
      InventoryRecord.aggregate([
        { $match: { productId: { $in: inactiveIds } } },
        { $group: { _id: '$productId', count: { $sum: 1 } } },
      ]),
    ]);

    const lastListedMap = new Map<string, Date>(
      lastListedAgg.map((r) => [String(r._id), r.lastDate])
    );
    const timesListedMap = new Map<string, number>(
      timesListedAgg.map((r) => [String(r._id), r.count])
    );

    const result = inactiveProducts.map((p) => ({
      _id: String(p._id),
      name: p.name,
      images: p.images ?? [],
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      discountPrice: (p as { discountPrice?: number | null }).discountPrice ?? null,
      isPerishable: p.isPerishable ?? false,
      sellerName: (p as { sellerName?: string }).sellerName ?? '',
      notes: (p as { notes?: string }).notes ?? '',
      lastListedDate: lastListedMap.get(String(p._id)) ?? null,
      timesListed: timesListedMap.get(String(p._id)) ?? 0,
    }));

    result.sort((a, b) => {
      if (!a.lastListedDate && !b.lastListedDate) return 0;
      if (!a.lastListedDate) return 1;
      if (!b.lastListedDate) return -1;
      return b.lastListedDate.getTime() - a.lastListedDate.getTime();
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[getListingHistory]', message);
    res.status(500).json({ message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/inventory/relist
// Creates a new daily InventoryRecord for an existing product.
// ---------------------------------------------------------------------------

export const relistProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, storeId, quantity, sellingPrice, discountPrice, costPrice } = req.body as {
      productId: string;
      storeId: string;
      quantity: number;
      sellingPrice?: number;
      discountPrice?: number | null;
      costPrice?: number;
    };

    if (!productId || !storeId || !quantity || quantity <= 0) {
      res.status(400).json({ message: 'productId, storeId, and a positive quantity are required' });
      return;
    }

    const product = await Product.findOne({ _id: productId, storeId }).lean();
    if (!product) {
      res.status(404).json({ message: 'Product not found in this store' });
      return;
    }

    const today = todayInAppTz();

    const existing = await InventoryRecord.findOne({ productId, date: today }).lean();
    if (existing) {
      res.status(409).json({ message: 'This product already has an active listing for today' });
      return;
    }

    const priceUpdate: Record<string, unknown> = { stockQuantity: quantity };
    if (typeof costPrice === 'number' && costPrice >= 0) {
      priceUpdate.costPrice = costPrice;
    }
    if (typeof sellingPrice === 'number' && sellingPrice >= 0) {
      priceUpdate.sellingPrice = sellingPrice;
    }
    if (discountPrice !== undefined) {
      priceUpdate.discountPrice = discountPrice === null || discountPrice === 0 ? null : discountPrice;
    }
    await Product.findByIdAndUpdate(productId, { $set: priceUpdate });

    const record = await InventoryRecord.create({
      productId: new mongoose.Types.ObjectId(productId),
      storeId: new mongoose.Types.ObjectId(storeId),
      date: today,
      initialStock: quantity,
      restock: 0,
      reduction: 0,
    });

    try {
      const io = getIO();
      const updatedProducts = await Product.find({ storeId }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
    } catch { /* socket broadcast is non-critical */ }

    res.status(201).json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[relistProduct]', message);
    res.status(500).json({ message });
  }
};
