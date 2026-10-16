import mongoose from 'mongoose';
import { toLocalDateStr } from '../config/timezone.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { PreOrderListing, type ListingSource } from '../models/PreOrderListing.js';
import { Product } from '../models/Product.js';
import { cutoffError, parseExpectedDate, parsePreOrderClosesAt } from './preorderWindow.js';

/** Listings written before `source` existed are pre-order periods. */
export const PREORDER_LISTING_FILTER = { source: { $ne: 'inventory' } } as const;

function listingSource(source?: string | null): ListingSource {
  return source === 'inventory' ? 'inventory' : 'preorder';
}

function todayUtcMidnight(): Date {
  return new Date(`${toLocalDateStr(new Date())}T00:00:00.000Z`);
}

export async function backfillInventoryListingPeriods(): Promise<void> {
  const migrations = mongoose.connection.collection('migrations');
  const key = '2026-10-17-inventory-listing-periods';
  if (await migrations.findOne({ key })) return;

  const today = todayUtcMidnight();
  const spans = await InventoryRecord.aggregate<{
    _id: mongoose.Types.ObjectId;
    storeId: mongoose.Types.ObjectId;
    first: Date;
    last: Date;
  }>([
    { $group: { _id: '$productId', storeId: { $first: '$storeId' }, first: { $min: '$date' }, last: { $max: '$date' } } },
  ]);

  const existing = await PreOrderListing.find({ source: 'inventory' }).select('productId').lean();
  const have = new Set(existing.map((row) => String(row.productId)));
  const docs = spans
    .filter((span) => !have.has(String(span._id)))
    .map((span) => {
      const stillListed = span.last.getTime() >= today.getTime();
      return {
        productId: span._id,
        storeId: span.storeId,
        source: 'inventory' as const,
        listedAt: span.first,
        unlistedAt: stillListed ? null : span.last,
      };
    });

  if (docs.length > 0) await PreOrderListing.insertMany(docs, { ordered: false });
  await migrations.insertOne({ key, appliedAt: new Date() });
  console.log(`Inventory listing periods recorded: ${docs.length}`);
}

export interface SharedHistoryRow {
  _id: string;
  name: string;
  images: string[];
  costPrice: number;
  sellingPrice: number;
  discountPrice: number | null;
  isPerishable: boolean;
  sellerName: string;
  notes: string;
  source: ListingSource;
  status: 'listed' | 'unlisted';
  lastListedAt: Date | null;
  lastListedDate: Date | null;
  unlistedAt: Date | null;
  timesListed: number;
  totalUnits: number;
  customerCount: number;
  preOrderExpectedDate: Date | null;
  preOrderClosesAt: Date | null;
}

export async function sharedListingHistory(storeId: string): Promise<SharedHistoryRow[]> {
  const products = await Product.find({ storeId }).lean();
  if (products.length === 0) return [];

  const ids = products.map((product) => product._id);
  const { demandForProducts } = await import('../controllers/preorder.controller.js');
  const [listings, todayRecords, demand] = await Promise.all([
    PreOrderListing.find({ productId: { $in: ids } }).lean(),
    InventoryRecord.find({ productId: { $in: ids }, date: todayUtcMidnight() }).select('productId').lean(),
    demandForProducts(ids),
  ]);

  const activeToday = new Set(todayRecords.map((record) => String(record.productId)));
  const byProduct = new Map<string, typeof listings>();
  for (const listing of listings) {
    const id = String(listing.productId);
    const group = byProduct.get(id) ?? [];
    group.push(listing);
    byProduct.set(id, group);
  }

  const rows: SharedHistoryRow[] = [];
  for (const product of products) {
    const id = String(product._id);
    const periods = byProduct.get(id) ?? [];
    const summary = demand.get(id) ?? { totalUnits: 0, customerCount: 0 };
    for (const source of ['inventory', 'preorder'] as const) {
      const own = periods.filter((period) => listingSource(period.source) === source);
      const stamp = (product as { createdAt?: unknown }).createdAt;
      const createdAt = stamp instanceof Date ? stamp : new Date();
      const legacyListed = own.length === 0 && (
        source === 'inventory'
          ? product.productType !== 'preorder' && activeToday.has(id)
          : product.productType === 'preorder'
      );
      if (own.length === 0 && !legacyListed) continue;
      const lastListedAt = own.length === 0
        ? createdAt
        : own.reduce(
          (latest, period) => (period.listedAt.getTime() > latest.getTime() ? period.listedAt : latest),
          own[0].listedAt
        );
      const open = own.some((period) => !period.unlistedAt);
      const listed = source === 'inventory'
        ? product.productType !== 'preorder' && activeToday.has(id)
        : product.productType === 'preorder' && (open || own.length === 0);
      const closedAt = own.reduce<Date | null>((latest, period) => {
        if (!period.unlistedAt) return latest;
        if (!latest || period.unlistedAt.getTime() > latest.getTime()) return period.unlistedAt;
        return latest;
      }, null);
      rows.push({
        _id: id,
        name: product.name,
        images: product.images ?? [],
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        discountPrice: product.discountPrice ?? null,
        isPerishable: product.isPerishable ?? false,
        sellerName: product.sellerName ?? '',
        notes: product.notes ?? '',
        source,
        status: listed ? 'listed' : 'unlisted',
        lastListedAt,
        lastListedDate: lastListedAt,
        unlistedAt: listed ? null : closedAt,
        timesListed: Math.max(own.length, legacyListed ? 1 : 0),
        totalUnits: source === 'preorder' ? summary.totalUnits : 0,
        customerCount: source === 'preorder' ? summary.customerCount : 0,
        preOrderExpectedDate: product.preOrderExpectedDate ?? null,
        preOrderClosesAt: product.preOrderClosesAt ?? null,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'listed' ? -1 : 1;
    const aTime = a.lastListedAt?.getTime() ?? 0;
    const bTime = b.lastListedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
  return rows;
}

export async function moveInventoryToPreOrder(
  storeId: string,
  productIds: string[],
  closesRaw: unknown,
  expectedRaw: unknown
): Promise<number> {
  const uniqueIds = [...new Set(productIds.filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  if (uniqueIds.length === 0) throw new Error('Select at least one product');

  const closes = parsePreOrderClosesAt(closesRaw);
  if (!closes.ok) throw new Error(closes.message);
  const expected = parseExpectedDate(expectedRaw);
  if (!expected.ok) throw new Error(expected.message);
  const windowError = cutoffError(closes.date, expected.date, { required: true, requireFuture: true });
  if (windowError) throw new Error(windowError);

  const today = todayUtcMidnight();
  const products = await Product.find({ _id: { $in: uniqueIds }, storeId });
  if (products.length !== uniqueIds.length) throw new Error('One or more products are not in this store');

  const records = await InventoryRecord.find({
    productId: { $in: products.map((product) => product._id) },
    date: today,
  }).select('productId').lean();
  const inToday = new Set(records.map((record) => String(record.productId)));

  for (const product of products) {
    if (product.productType === 'preorder') {
      throw new Error(`"${product.name}" is already a pre-order`);
    }
    if (!inToday.has(String(product._id))) {
      throw new Error(`"${product.name}" is not in today's inventory`);
    }
  }

  const now = new Date();
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    for (const product of products) {
      const closed = await PreOrderListing.updateMany(
        { productId: product._id, source: 'inventory', unlistedAt: null },
        { $set: { unlistedAt: now } },
        { session }
      );
      if (closed.modifiedCount === 0) {
        const createdAt = product.get('createdAt');
        await PreOrderListing.create([{
          productId: product._id,
          storeId: product.storeId,
          source: 'inventory',
          listedAt: createdAt instanceof Date ? createdAt : now,
          unlistedAt: now,
        }], { session });
      }
      await InventoryRecord.deleteMany({ productId: product._id, date: today }).session(session);
      product.productType = 'preorder';
      product.stockQuantity = 0;
      product.preOrderOpen = true;
      product.preOrderStatus = 'pending';
      product.preOrderClosesAt = closes.date;
      product.preOrderExpectedDate = expected.date;
      await product.save({ session });
      await PreOrderListing.create([{
        productId: product._id,
        storeId: product.storeId,
        source: 'preorder',
        listedAt: now,
        unlistedAt: null,
      }], { session });
    }
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  return products.length;
}
