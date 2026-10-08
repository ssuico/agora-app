import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { PreOrderListing } from '../models/PreOrderListing.js';
import { Product } from '../models/Product.js';
import { getPreOrderDisplayStatus, Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { cutoffError, parseExpectedDate, parsePreOrderClosesAt } from '../services/preorderWindow.js';
import { UserRole } from '../types/index.js';

export async function demandForProducts(
  productIds: mongoose.Types.ObjectId[]
): Promise<Map<string, { totalUnits: number; customerCount: number }>> {
  const map = new Map<string, { totalUnits: number; customerCount: number }>();
  if (productIds.length === 0) return map;

  const rows = await TransactionItem.aggregate<{
    _id: mongoose.Types.ObjectId;
    totalUnits: number;
    customers: string[];
  }>([
    { $match: { productId: { $in: productIds } } },
    {
      $lookup: {
        from: 'transactions',
        localField: 'transactionId',
        foreignField: '_id',
        as: 'tx',
      },
    },
    { $unwind: '$tx' },
    {
      $match: {
        'tx.orderType': 'preorder',
        'tx.orderStatus': { $ne: 'cancelled' },
        $nor: [{ 'tx.claimStatus': 'claimed', 'tx.paymentStatus': 'paid' }],
      },
    },
    {
      $addFields: {
        customerKey: {
          $cond: [
            { $ifNull: ['$tx.customerId', false] },
            { $toString: '$tx.customerId' },
            { $ifNull: ['$tx.walkInCustomerName', 'walk-in'] },
          ],
        },
      },
    },
    {
      $group: {
        _id: '$productId',
        totalUnits: { $sum: '$quantity' },
        customers: { $addToSet: '$customerKey' },
      },
    },
  ]);

  for (const row of rows) {
    map.set(String(row._id), {
      totalUnits: row.totalUnits,
      customerCount: row.customers?.length ?? 0,
    });
  }
  return map;
}

export const getPreOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const products = await listedPreOrderProducts(storeId);

    const demand = await demandForProducts(products.map((p) => p._id));

    res.json(
      products.map((product) => {
        const summary = demand.get(String(product._id)) ?? { totalUnits: 0, customerCount: 0 };
        return {
          ...product,
          totalUnits: summary.totalUnits,
          customerCount: summary.customerCount,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getPreOrderOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.productId).lean();
    if (!product || product.productType !== 'preorder') {
      res.status(404).json({ message: 'Pre-order product not found' });
      return;
    }

    if (
      req.user!.role === UserRole.STORE_MANAGER &&
      !req.user!.storeIds?.includes(String(product.storeId))
    ) {
      res.status(403).json({ message: 'Forbidden: you are not assigned to this store' });
      return;
    }

    const items = await TransactionItem.find({ productId: product._id }).lean();
    const qtyByTx = new Map<string, { quantity: number; subtotal: number }>();
    for (const item of items) {
      const key = String(item.transactionId);
      const existing = qtyByTx.get(key) ?? { quantity: 0, subtotal: 0 };
      existing.quantity += item.quantity;
      existing.subtotal += item.subtotal;
      qtyByTx.set(key, existing);
    }

    const transactions = await Transaction.find({
      _id: { $in: [...qtyByTx.keys()] },
      orderType: 'preorder',
    })
      .populate('customerId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const orders = transactions.map((tx) => {
      const line = qtyByTx.get(String(tx._id)) ?? { quantity: 0, subtotal: 0 };
      const customer = tx.customerId as unknown as { name?: string; email?: string } | null;
      return {
        _id: tx._id,
        customerName: customer?.name ?? tx.walkInCustomerName ?? 'Walk-in',
        customerEmail: customer?.email ?? null,
        quantity: line.quantity,
        subtotal: line.subtotal,
        claimStatus: tx.claimStatus,
        paymentStatus: tx.paymentStatus,
        orderStatus: tx.orderStatus,
        preOrderStatus: getPreOrderDisplayStatus(tx, product),
        customerNotes: tx.customerNotes ?? null,
        createdAt: tx.createdAt,
      };
    });

    const active = orders.filter(
      (order) => order.preOrderStatus === 'pending' || order.preOrderStatus === 'ready'
    );
    const customers = new Set(active.map((order) => order.customerEmail ?? order.customerName));

    res.json({
      product: {
        _id: product._id,
        name: product.name,
        sellingPrice: product.sellingPrice,
        discountPrice: product.discountPrice ?? null,
        preOrderStatus: product.preOrderStatus,
        preOrderOpen: product.preOrderOpen,
        preOrderExpectedDate: product.preOrderExpectedDate ?? null,
      },
      totalUnits: active.reduce((sum, order) => sum + order.quantity, 0),
      customerCount: customers.size,
      orders,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

type ListingStat = { timesListed: number; lastListedAt: Date; unlistedAt: Date | null };

async function listingIndex(productIds: mongoose.Types.ObjectId[]) {
  const listings = productIds.length
    ? await PreOrderListing.find({ productId: { $in: productIds } }).lean()
    : [];
  const openIds = new Set<string>();
  const knownIds = new Set<string>();
  const stats = new Map<string, ListingStat>();

  for (const listing of listings) {
    const id = String(listing.productId);
    knownIds.add(id);
    if (!listing.unlistedAt) openIds.add(id);
    const stat = stats.get(id) ?? {
      timesListed: 0,
      lastListedAt: listing.listedAt,
      unlistedAt: null,
    };
    stat.timesListed += 1;
    if (listing.listedAt.getTime() >= stat.lastListedAt.getTime()) stat.lastListedAt = listing.listedAt;
    if (listing.unlistedAt && (!stat.unlistedAt || listing.unlistedAt.getTime() > stat.unlistedAt.getTime())) {
      stat.unlistedAt = listing.unlistedAt;
    }
    stats.set(id, stat);
  }

  for (const id of openIds) {
    const stat = stats.get(id);
    if (stat) stat.unlistedAt = null;
  }

  return { openIds, knownIds, stats };
}

function isCurrentlyListed(id: string, openIds: Set<string>, knownIds: Set<string>): boolean {
  return openIds.has(id) || !knownIds.has(id);
}

async function listedPreOrderProducts(storeId: string) {
  const products = await Product.find({ storeId, productType: 'preorder' }).sort({ createdAt: -1 }).lean();
  const { openIds, knownIds } = await listingIndex(products.map((product) => product._id));
  return products.filter((product) => isCurrentlyListed(String(product._id), openIds, knownIds));
}

function managerCanAccess(req: Request, storeId: string, res: Response): boolean {
  if (req.user!.role === UserRole.STORE_MANAGER && !req.user!.storeIds?.includes(storeId)) {
    res.status(403).json({ message: 'Forbidden: you are not assigned to this store' });
    return false;
  }
  return true;
}

export const getPreOrderHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const products = await Product.find({ storeId, productType: 'preorder' }).sort({ createdAt: -1 }).lean();
    const { openIds, knownIds, stats } = await listingIndex(products.map((product) => product._id));
    const history = products.filter((product) => {
      const id = String(product._id);
      return knownIds.has(id) && !openIds.has(id);
    });
    const demand = await demandForProducts(history.map((product) => product._id));

    res.json(
      history.map((product) => {
        const id = String(product._id);
        const stat = stats.get(id);
        const summary = demand.get(id) ?? { totalUnits: 0, customerCount: 0 };
        return {
          ...product,
          totalUnits: summary.totalUnits,
          customerCount: summary.customerCount,
          timesListed: stat?.timesListed ?? 0,
          lastListedAt: stat?.lastListedAt ?? null,
          unlistedAt: stat?.unlistedAt ?? null,
        };
      })
    );
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const unlistPreOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product || product.productType !== 'preorder') {
      res.status(404).json({ message: 'Pre-order product not found' });
      return;
    }
    if (!managerCanAccess(req, String(product.storeId), res)) return;

    const open = await PreOrderListing.findOne({ productId: product._id, unlistedAt: null });
    if (open) {
      open.unlistedAt = new Date();
      await open.save();
    } else {
      const anyListing = await PreOrderListing.exists({ productId: product._id });
      if (anyListing) {
        res.status(400).json({ message: 'This pre-order is already unlisted' });
        return;
      }
      const createdAt = product.get('createdAt');
      await PreOrderListing.create({
        productId: product._id,
        storeId: product.storeId,
        listedAt: createdAt instanceof Date ? createdAt : new Date(),
        unlistedAt: new Date(),
      });
    }

    product.preOrderOpen = false;
    await product.save();
    res.json({ message: 'Pre-order unlisted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const relistPreOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product || product.productType !== 'preorder') {
      res.status(404).json({ message: 'Pre-order product not found' });
      return;
    }
    if (!managerCanAccess(req, String(product.storeId), res)) return;

    const alreadyListed = await PreOrderListing.findOne({ productId: product._id, unlistedAt: null }).lean();
    if (alreadyListed) {
      res.status(409).json({ message: 'This pre-order is already listed' });
      return;
    }

    const closes = parsePreOrderClosesAt(req.body.preOrderClosesAt);
    if (!closes.ok) {
      res.status(400).json({ message: closes.message });
      return;
    }
    const expected = parseExpectedDate(
      req.body.preOrderExpectedDate === undefined ? product.preOrderExpectedDate : req.body.preOrderExpectedDate
    );
    if (!expected.ok) {
      res.status(400).json({ message: expected.message });
      return;
    }
    const windowError = cutoffError(closes.date, expected.date, { required: true, requireFuture: true });
    if (windowError) {
      res.status(400).json({ message: windowError });
      return;
    }

    product.preOrderClosesAt = closes.date;
    product.preOrderExpectedDate = expected.date;
    product.preOrderOpen = true;
    product.preOrderStatus = 'pending';
    await product.save();
    await PreOrderListing.create({
      productId: product._id,
      storeId: product.storeId,
      listedAt: new Date(),
      unlistedAt: null,
    });

    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
