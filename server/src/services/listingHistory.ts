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

/**
 * A product belongs to one catalog. Listings of the other source are removed
 * when the current source already has records; otherwise those listings are
 * relabeled. Extra open listings are closed so only one stays listed.
 */
export async function collapseDualListingSources(): Promise<void> {
  const migrations = mongoose.connection.collection('migrations');
  const key = '2026-10-17-single-listing-source';
  if (await migrations.findOne({ key })) return;

  const dual = await PreOrderListing.aggregate<{ _id: mongoose.Types.ObjectId }>([
    { $addFields: { resolvedSource: { $ifNull: ['$source', 'preorder'] } } },
    { $group: { _id: '$productId', sources: { $addToSet: '$resolvedSource' } } },
    { $match: { sources: { $all: ['inventory', 'preorder'] } } },
  ]);
  const products = await Product.find({ _id: { $in: dual.map((row) => row._id) } }).select('_id productType').lean();
  let removed = 0;
  for (const product of products) {
    const canonical: ListingSource = product.productType === 'preorder' ? 'preorder' : 'inventory';
    const result = await PreOrderListing.deleteMany(
      canonical === 'inventory'
        ? { productId: product._id, source: { $ne: 'inventory' } }
        : { productId: product._id, source: 'inventory' }
    );
    removed += result.deletedCount ?? 0;
  }

  const extraOpens = await PreOrderListing.aggregate<{ ids: mongoose.Types.ObjectId[] }>([
    { $match: { unlistedAt: null } },
    { $sort: { listedAt: -1 } },
    { $group: { _id: '$productId', ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ]);
  for (const row of extraOpens) {
    await PreOrderListing.updateMany(
      { _id: { $in: row.ids.slice(1) } },
      { $set: { unlistedAt: new Date() } }
    );
  }

  await migrations.insertOne({ key, appliedAt: new Date() });
  console.log(`Duplicate listing sources removed: ${removed}`);
}

/**
 * Point every listing for a product at one source.
 * `convert` keeps the current open listing (a move between catalogs).
 * `relist` closes it and starts a new period, still under that one source.
 */
export async function retargetListings(
  productId: mongoose.Types.ObjectId | string,
  storeId: mongoose.Types.ObjectId | string,
  source: ListingSource,
  mode: 'convert' | 'relist',
  session?: mongoose.ClientSession
): Promise<void> {
  const writeOpts = session ? { session } : undefined;
  await PreOrderListing.updateMany({ productId }, { $set: { source } }, writeOpts);
  if (mode === 'relist') {
    await PreOrderListing.updateMany(
      { productId, unlistedAt: null },
      { $set: { unlistedAt: new Date() } },
      writeOpts
    );
  }
  const openQuery = PreOrderListing.find({ productId, unlistedAt: null }).sort({ listedAt: -1 });
  if (session) openQuery.session(session);
  const open = await openQuery;
  if (open.length === 0) {
    await PreOrderListing.create([{
      productId,
      storeId,
      source,
      listedAt: new Date(),
      unlistedAt: null,
    }], writeOpts);
    return;
  }
  if (open.length > 1) {
    await PreOrderListing.updateMany(
      { _id: { $in: open.slice(1).map((row) => row._id) } },
      { $set: { unlistedAt: new Date() } },
      writeOpts
    );
  }
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
    const source: ListingSource = product.productType === 'preorder' ? 'preorder' : 'inventory';
    const own = periods.filter((period) => listingSource(period.source) === source);
    const counted = own.length > 0 ? own : periods;
    const stamp = (product as { createdAt?: unknown }).createdAt;
    const createdAt = stamp instanceof Date ? stamp : new Date();
    const legacyListed = counted.length === 0 && (
      source === 'inventory' ? activeToday.has(id) : product.productType === 'preorder'
    );
    if (counted.length === 0 && !legacyListed) continue;
    const lastListedAt = counted.length === 0
      ? createdAt
      : counted.reduce(
        (latest, period) => (period.listedAt.getTime() > latest.getTime() ? period.listedAt : latest),
        counted[0].listedAt
      );
    const open = counted.some((period) => !period.unlistedAt);
    const listed = source === 'inventory'
      ? activeToday.has(id)
      : open || counted.length === 0;
    const closedAt = counted.reduce<Date | null>((latest, period) => {
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
      timesListed: Math.max(counted.length, legacyListed ? 1 : 0),
      totalUnits: source === 'preorder' ? summary.totalUnits : 0,
      customerCount: source === 'preorder' ? summary.customerCount : 0,
      preOrderExpectedDate: product.preOrderExpectedDate ?? null,
      preOrderClosesAt: product.preOrderClosesAt ?? null,
    });
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

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    for (const product of products) {
      await retargetListings(product._id, product.storeId, 'preorder', 'convert', session);
      await InventoryRecord.deleteMany({ productId: product._id, date: today }).session(session);
      product.productType = 'preorder';
      product.stockQuantity = 0;
      product.preOrderOpen = true;
      product.preOrderStatus = 'pending';
      product.preOrderClosesAt = closes.date;
      product.preOrderExpectedDate = expected.date;
      await product.save({ session });
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
