import mongoose from 'mongoose';
import { localDayRange, localDayRangeFromDateString, toLocalDateStr } from '../config/timezone.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product, REGULAR_PRODUCT_FILTER } from '../models/Product.js';
import { Store } from '../models/Store.js';
import { StoreClosing, type IStoreClosing } from '../models/StoreClosing.js';
import { StoreDayCloseCursor } from '../models/StoreDayCloseCursor.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { getIO } from '../socket.js';

const CURSOR_KEY = 'inventory-day-close';

export class StoreDayCloseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StoreDayCloseError';
    this.status = status;
  }
}

export function toDateOnly(input: string | Date): Date {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function todayInAppTz(): Date {
  return toDateOnly(toLocalDateStr(new Date()));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = toDateOnly(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function msUntilJustAfterLocalMidnight(now = new Date()): number {
  const todayStr = toLocalDateStr(now);
  const { dayEnd } = localDayRangeFromDateString(todayStr);
  const delay = dayEnd.getTime() + 1 + 2_000 - now.getTime();
  return delay > 0 ? delay : 60_000;
}

export async function computeSoldMap(
  storeId: string | mongoose.Types.ObjectId,
  date: Date,
  productIds: mongoose.Types.ObjectId[]
): Promise<Map<string, number>> {
  const { dayStart, dayEnd } = localDayRange(date);

  const activeTxIds = await Transaction.find({
    storeId,
    orderStatus: { $ne: 'cancelled' },
    orderType: { $ne: 'preorder' },
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

  return new Map<string, number>(soldAgg.map((s) => [String(s._id), s.totalSold]));
}

interface CloseSelection {
  productId: string;
  carryOver: boolean;
}

export interface CloseStoreDayResult {
  closing: IStoreClosing | null;
  skipped: boolean;
  carriedCount: number;
  storefrontClosed: boolean;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000;
}

function emitStorefrontClosed(storeId: string): void {
  try {
    getIO().to(`store:${storeId}`).emit('store:status-changed', { storeId, isOpen: false });
  } catch {
    /* socket broadcast is non-critical */
  }
}

async function nextDayAlreadyStarted(storeId: string, nextDay: Date): Promise<boolean> {
  const hasInventory = await InventoryRecord.exists({ storeId, date: nextDay });
  if (hasInventory) return true;

  const { dayStart, dayEnd } = localDayRange(nextDay);
  const hasSale = await Transaction.exists({
    storeId,
    orderStatus: { $ne: 'cancelled' },
    createdAt: { $gte: dayStart, $lte: dayEnd },
  });
  return Boolean(hasSale);
}

/**
 * Close one store for one calendar day.
 * Manual mode uses the manager's selections and refreshes next-day rows.
 * Auto mode carries only non-perishable products that still have stock,
 * and only creates a next-day row when one is not already there.
 */
export async function closeStoreDay(input: {
  storeId: string;
  date: Date;
  mode: 'manual' | 'auto';
  selections?: CloseSelection[];
  closedBy?: string;
}): Promise<CloseStoreDayResult> {
  const { storeId, mode } = input;
  const date = toDateOnly(input.date);

  if (mode === 'auto') {
    const existing = await StoreClosing.findOne({ storeId, date });
    if (existing) {
      return { closing: existing, skipped: true, carriedCount: 0, storefrontClosed: false };
    }
  }

  const products = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).lean();
  if (products.length === 0 && mode === 'manual') {
    throw new StoreDayCloseError('No products found for this store', 400);
  }

  const productIds = products.map((p) => p._id);
  const records =
    productIds.length === 0
      ? []
      : await InventoryRecord.find({ productId: { $in: productIds }, date }).lean();
  const soldMap = productIds.length === 0 ? new Map<string, number>() : await computeSoldMap(storeId, date, productIds);
  const recordMap = new Map(records.map((r) => [String(r.productId), r]));
  const selectionMap = new Map((input.selections ?? []).map((s) => [s.productId, s.carryOver]));

  const carryOverSelections = products
    .filter((product) => recordMap.has(String(product._id)))
    .map((product) => {
      const pid = String(product._id);
      const rec = recordMap.get(pid)!;
      const sold = soldMap.get(pid) ?? 0;
      const reduction = rec.reduction ?? 0;
      const currentStock = Math.max(0, rec.initialStock + rec.restock - reduction - sold);
      const carryOver =
        mode === 'auto'
          ? !product.isPerishable && currentStock > 0
          : (selectionMap.get(pid) ?? !product.isPerishable);

      return {
        productId: product._id,
        carryOver,
        currentStock,
      };
    });

  const nextDay = addUtcDays(date, 1);
  const carried = carryOverSelections.filter((sel) => sel.carryOver);
  const notCarried = carryOverSelections.filter((sel) => !sel.carryOver);
  // Read this before inserting carry-over rows, or those rows look like the new day already started.
  const yesterday = addUtcDays(todayInAppTz(), -1);
  const isLatestEndedDay = date.getTime() === yesterday.getTime();
  const alreadyStarted = mode === 'auto' && isLatestEndedDay ? await nextDayAlreadyStarted(storeId, nextDay) : false;

  let storefrontClosed = false;
  if (mode === 'auto' && isLatestEndedDay && !alreadyStarted) {
    await Store.findByIdAndUpdate(storeId, { isOpen: false });
    emitStorefrontClosed(storeId);
    storefrontClosed = true;
  }

  if (mode === 'manual' && notCarried.length > 0) {
    await InventoryRecord.deleteMany({
      productId: { $in: notCarried.map((s) => s.productId) },
      date: nextDay,
      restock: 0,
    });
  }

  if (carried.length > 0) {
    const bulkOps = carried.map((sel) =>
      mode === 'auto'
        ? {
            updateOne: {
              filter: { productId: sel.productId, date: nextDay },
              update: {
                $setOnInsert: {
                  storeId: new mongoose.Types.ObjectId(storeId),
                  initialStock: sel.currentStock,
                  restock: 0,
                  reduction: 0,
                },
              },
              upsert: true,
            },
          }
        : {
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
          }
    );
    await InventoryRecord.bulkWrite(bulkOps);
  }

  const $set: Record<string, unknown> = {
    storeId,
    date,
    closedAt: new Date(),
    carryOverSelections,
  };
  if (input.closedBy) $set.closedBy = input.closedBy;

  let closing: IStoreClosing | null;
  try {
    closing = await StoreClosing.findOneAndUpdate(
      { storeId, date },
      { $set, $setOnInsert: { autoClosed: mode === 'auto' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    if (mode === 'auto' && isDuplicateKey(err)) {
      const existing = await StoreClosing.findOne({ storeId, date });
      return { closing: existing, skipped: true, carriedCount: 0, storefrontClosed };
    }
    throw err;
  }

  if (!closing) {
    throw new StoreDayCloseError('Could not save the store closing', 500);
  }

  if (mode === 'manual') {
    await Store.findByIdAndUpdate(storeId, { isOpen: false });
    emitStorefrontClosed(storeId);
    storefrontClosed = true;
  }

  return {
    closing,
    skipped: false,
    carriedCount: carried.length,
    storefrontClosed,
  };
}

let running = false;
let pending = false;
let bootTimer: NodeJS.Timeout | null = null;
let hourlyTimer: NodeJS.Timeout | null = null;
let midnightTimer: NodeJS.Timeout | null = null;

async function closeThroughYesterday(): Promise<void> {
  const yesterday = addUtcDays(todayInAppTz(), -1);
  const cursor = await StoreDayCloseCursor.findOne({ key: CURSOR_KEY }).lean();
  const start = cursor ? addUtcDays(cursor.lastClosedDate, 1) : yesterday;
  if (start.getTime() > yesterday.getTime()) return;

  const stores = await Store.find().select('_id name').lean();

  for (let date = start; date.getTime() <= yesterday.getTime(); date = addUtcDays(date, 1)) {
    const dateLabel = date.toISOString().slice(0, 10);
    let failed = false;

    for (const store of stores) {
      try {
        const result = await closeStoreDay({
          storeId: String(store._id),
          date,
          mode: 'auto',
        });
        if (!result.skipped) {
          const storefront = result.storefrontClosed ? 'store closed' : 'store left as-is';
          console.log(
            `[autoClose] ${store.name} ${dateLabel}: carried ${result.carriedCount} non-perishable item(s), ${storefront}`
          );
        }
      } catch (err) {
        failed = true;
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[autoClose] ${store.name} ${dateLabel} failed: ${message}`);
      }
    }

    if (failed) return;

    await StoreDayCloseCursor.findOneAndUpdate(
      { key: CURSOR_KEY },
      { key: CURSOR_KEY, lastClosedDate: date },
      { upsert: true }
    );
  }
}

export async function runMissedStoreDayCloses(): Promise<void> {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  try {
    do {
      pending = false;
      await closeThroughYesterday();
    } while (pending);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[autoClose]', message);
  } finally {
    running = false;
  }
}

export function startStoreDayCloseScheduler(): void {
  if (bootTimer || hourlyTimer || midnightTimer) return;

  bootTimer = setTimeout(() => {
    void runMissedStoreDayCloses();
  }, 5_000);

  hourlyTimer = setInterval(() => {
    void runMissedStoreDayCloses();
  }, 60 * 60 * 1000);

  const armMidnight = () => {
    midnightTimer = setTimeout(() => {
      void runMissedStoreDayCloses();
      armMidnight();
    }, msUntilJustAfterLocalMidnight());
  };
  armMidnight();

  console.log('[autoClose] End-of-day store close scheduled for local midnight.');
}
