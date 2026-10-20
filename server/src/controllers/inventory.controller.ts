import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { PreOrderListing } from '../models/PreOrderListing.js';
import { Product, REGULAR_PRODUCT_FILTER } from '../models/Product.js';
import { moveInventoryToPreOrder, retargetListings, sharedListingHistory } from '../services/listingHistory.js';
import {
  physicalOnHand,
  planReconciliation,
  preOrderBreakdown,
  recordMovement,
} from '../services/inventoryReconciliation.js';
import {
  closeStoreDay,
  computeSoldMap,
  StoreDayCloseError,
  toDateOnly,
  todayInAppTz,
} from '../services/storeDayClose.js';
import { Store } from '../models/Store.js';
import { StoreClosing } from '../models/StoreClosing.js';
import { getIO } from '../socket.js';

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

    const products = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
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

    const product = await Product.findById(productId).select('productType').lean();
    if (product?.productType === 'preorder') {
      res.status(400).json({ message: 'Pre-order products are not part of inventory' });
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
      const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
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
    if (product.productType === 'preorder') {
      res.status(400).json({ message: 'Pre-order products are not part of inventory' });
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
      const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
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

    const result = await closeStoreDay({
      storeId,
      date: toDateOnly(dateStr),
      mode: 'manual',
      selections,
      closedBy: req.user!.userId,
    });

    res.json(result.closing);
  } catch (err) {
    if (err instanceof StoreDayCloseError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
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
    res.json(await sharedListingHistory(storeId));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[getListingHistory]', message);
    res.status(500).json({ message });
  }
};

export const moveToPreOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, productIds, preOrderClosesAt, preOrderExpectedDate } = req.body as {
      storeId?: string;
      productIds?: string[];
      preOrderClosesAt?: unknown;
      preOrderExpectedDate?: unknown;
    };
    if (!storeId || !Array.isArray(productIds)) {
      res.status(400).json({ message: 'storeId and productIds are required' });
      return;
    }
    const moved = await moveInventoryToPreOrder(
      storeId,
      productIds,
      preOrderClosesAt,
      preOrderExpectedDate,
      req.user?.userId
    );
    try {
      const io = getIO();
      const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
    } catch { /* socket broadcast is non-critical */ }
    res.json({ moved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not move products';
    res.status(400).json({ message });
  }
};

// ---------------------------------------------------------------------------
// POST /api/inventory/relist
// Creates a new daily InventoryRecord for an existing product.
// ---------------------------------------------------------------------------

export const getReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.productId).lean();
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    const physical = physicalOnHand(product);
    const breakdown = await preOrderBreakdown(product._id);
    res.json({
      productId: product._id,
      name: product.name,
      stockQuantity: product.stockQuantity,
      reservedQuantity: product.reservedQuantity ?? 0,
      physical,
      ...breakdown,
      additionalNeeded: Math.max(0, breakdown.outstanding - physical),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[getReconciliation]', message);
    res.status(500).json({ message });
  }
};

export const relistProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      productId?: string;
      storeId?: string;
      received?: unknown;
      quantity?: unknown;
      sellingPrice?: number;
      discountPrice?: number | null;
      costPrice?: number;
    };
    const { productId, storeId, sellingPrice, discountPrice, costPrice } = body;
    const rawReceived = body.received ?? body.quantity;
    const received = typeof rawReceived === 'number' ? rawReceived : Number(rawReceived);

    if (!productId || !storeId || !Number.isInteger(received) || received < 0) {
      res.status(400).json({ message: 'productId, storeId, and received units (0 or more) are required' });
      return;
    }

    const product = await Product.findOne({ _id: productId, storeId });
    if (!product) {
      res.status(404).json({ message: 'Product not found in this store' });
      return;
    }
    if (product.productType === 'preorder') {
      const openPreOrder = await PreOrderListing.findOne({
        productId: product._id,
        unlistedAt: null,
        source: { $ne: 'inventory' },
      }).lean();
      if (openPreOrder) {
        res.status(409).json({ message: 'Unlist this pre-order before listing it in inventory' });
        return;
      }
    }

    const today = todayInAppTz();
    const existing = await InventoryRecord.findOne({ productId, date: today }).lean();
    // A closed pre-order can still have today's shelf row from before it left inventory.
    // That row is not an active listing. A regular product with today's row is.
    if (existing && product.productType !== 'preorder') {
      res.status(409).json({ message: 'This product already has an active listing for today' });
      return;
    }

    const breakdown = await preOrderBreakdown(product._id);
    const plan = planReconciliation(physicalOnHand(product), breakdown.outstanding, received);
    if (plan.shortage > 0) {
      res.status(409).json({
        message: `Short by ${plan.shortage}. Receive enough stock to cover outstanding pre-orders before listing this for regular sales.`,
        shortage: plan.shortage,
      });
      return;
    }

    const session = await mongoose.startSession();
    let record: unknown = null;
    try {
      session.startTransaction();
      const current = await Product.findById(product._id).session(session);
      if (!current) throw new Error('Product not found in this store');
      const liveBreakdown = await preOrderBreakdown(current._id);
      const live = planReconciliation(physicalOnHand(current), liveBreakdown.outstanding, received);
      if (live.shortage > 0) {
        await session.abortTransaction();
        res.status(409).json({
          message: `Short by ${live.shortage}. Receive enough stock to cover outstanding pre-orders before listing this for regular sales.`,
          shortage: live.shortage,
        });
        return;
      }

      const fromMode = current.productType === 'preorder' ? 'preorder' : 'inventory';
      current.reservedQuantity = live.reserved;
      current.stockQuantity = live.available;
      current.productType = 'regular';
      current.preOrderOpen = false;
      if (typeof costPrice === 'number' && costPrice >= 0) current.costPrice = costPrice;
      if (typeof sellingPrice === 'number' && sellingPrice >= 0) current.sellingPrice = sellingPrice;
      if (discountPrice !== undefined) {
        current.discountPrice = discountPrice === null || discountPrice === 0 ? null : discountPrice;
      }
      await current.save({ session });
      await retargetListings(current._id, storeId, 'inventory', 'relist', session);
      if (fromMode === 'preorder') {
        await InventoryRecord.deleteMany({ productId: current._id, date: today }, { session });
      }
      const created = await InventoryRecord.create([{
        productId: current._id,
        storeId: new mongoose.Types.ObjectId(storeId),
        date: today,
        initialStock: live.available,
        restock: 0,
        reduction: 0,
      }], { session });
      record = created[0];
      await recordMovement({
        productId: current._id,
        storeId,
        quantity: received,
        kind: 'receipt',
        sourceMode: fromMode,
        destinationMode: 'inventory',
        actor: { userId: req.user?.userId },
      }, session);
      await recordMovement({
        productId: current._id,
        storeId,
        quantity: live.reserved,
        kind: 'reserve',
        sourceMode: fromMode,
        destinationMode: 'inventory',
        actor: { userId: req.user?.userId },
      }, session);
      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      const duplicate = typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000;
      if (duplicate) {
        res.status(409).json({ message: 'This product already has an active listing for today' });
        return;
      }
      throw err;
    } finally {
      session.endSession();
    }

    try {
      const io = getIO();
      const updatedProducts = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
      io.to(`store:${storeId}`).emit('stock:updated', updatedProducts);
    } catch { /* socket broadcast is non-critical */ }

    res.status(201).json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('[relistProduct]', message);
    if (!res.headersSent) res.status(500).json({ message });
  }
};
