import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { ActivityLog } from '../models/ActivityLog.js';
import { Product } from '../models/Product.js';
import { Rating } from '../models/Rating.js';
import { Transaction } from '../models/Transaction.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { User } from '../models/User.js';
import { getIO } from '../socket.js';

/** Returns true if the customer has ever purchased the given product. */
const customerHasPurchased = async (customerId: string, productId: string): Promise<boolean> => {
  // Find TransactionItems for this product, then verify one of those transactions belongs to the customer
  const items = await TransactionItem.find(
    { productId: new mongoose.Types.ObjectId(productId) },
    { transactionId: 1 }
  ).lean();
  if (items.length === 0) return false;
  const txIds = items.map((i) => i.transactionId);
  return !!(await Transaction.exists({ _id: { $in: txIds }, customerId: new mongoose.Types.ObjectId(customerId) }));
};

export const createRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { storeId, ratings } = req.body as {
      storeId?: string;
      ratings: Array<{
        productId?: string | null;
        stars: number;
        comment?: string;
        type: 'product' | 'store';
      }>;
    };

    if (!Array.isArray(ratings) || ratings.length === 0) {
      res.status(400).json({ message: 'ratings array is required' });
      return;
    }

    const ratingType = ratings[0]?.type;

    // ── Store rating ─────────────────────────────────────────────────────────
    if (ratingType === 'store') {
      if (!storeId) {
        res.status(400).json({ message: 'storeId is required for store ratings' });
        return;
      }
      const entry = ratings[0];
      await Rating.findOneAndUpdate(
        { storeId: new mongoose.Types.ObjectId(storeId), customerId: new mongoose.Types.ObjectId(customerId), type: 'store', transactionId: null },
        {
          $set: { stars: entry.stars, comment: entry.comment?.trim() || null },
          $setOnInsert: {
            storeId: new mongoose.Types.ObjectId(storeId),
            customerId: new mongoose.Types.ObjectId(customerId),
            type: 'store' as const,
            productId: null,
            transactionId: null,
          },
        },
        { upsert: true, new: true }
      );

      const actorName = req.user?.name ?? 'A customer';
      const userDoc = await User.findById(customerId).select('avatar').lean();
      const activityDoc = await ActivityLog.create({
        storeId,
        type: 'rating_submitted',
        actorName,
        actorAvatar: userDoc?.avatar || null,
        message: `${actorName} rated the store`,
        metadata: { ratingCount: 1 },
      });
      try { getIO().to(`store:${storeId}`).emit('activity:new', activityDoc); } catch { /* non-critical */ }
      res.status(201).json({ message: 'Store rating submitted', count: 1 });
      return;
    }

    // ── Product ratings ───────────────────────────────────────────────────────
    const productEntries = ratings.filter((r) => r.type === 'product' && r.productId);
    if (productEntries.length === 0) {
      res.status(400).json({ message: 'No valid product rating entries provided' });
      return;
    }

    // Eligibility: customer must have purchased each product at least once
    for (const r of productEntries) {
      const hasPurchased = await customerHasPurchased(customerId, r.productId!);
      if (!hasPurchased) {
        res.status(403).json({ message: 'You must purchase the product before rating it.' });
        return;
      }
    }

    // Upsert each product rating; derive storeId from product document
    let resolvedStoreId: string = storeId ?? '';
    await Promise.all(
      productEntries.map(async (r) => {
        if (!resolvedStoreId) {
          const product = await Product.findById(r.productId).select('storeId').lean();
          resolvedStoreId = String(product?.storeId ?? '');
        }
        return Rating.findOneAndUpdate(
          { productId: new mongoose.Types.ObjectId(r.productId!), customerId: new mongoose.Types.ObjectId(customerId), type: 'product' },
          {
            $set: { stars: r.stars, comment: r.comment?.trim() || null },
            $setOnInsert: {
              storeId: new mongoose.Types.ObjectId(resolvedStoreId),
              productId: new mongoose.Types.ObjectId(r.productId!),
              customerId: new mongoose.Types.ObjectId(customerId),
              type: 'product' as const,
              transactionId: null,
            },
          },
          { upsert: true, new: true }
        );
      })
    );

    const actorName = req.user?.name ?? 'A customer';
    const userDoc = await User.findById(customerId).select('avatar').lean();
    if (resolvedStoreId) {
      const activityDoc = await ActivityLog.create({
        storeId: resolvedStoreId,
        type: 'rating_submitted',
        actorName,
        actorAvatar: userDoc?.avatar || null,
        message: `${actorName} rated a product`,
        metadata: { ratingCount: productEntries.length },
      });
      try { getIO().to(`store:${resolvedStoreId}`).emit('activity:new', activityDoc); } catch { /* non-critical */ }
    }

    res.status(201).json({ message: 'Ratings submitted', count: productEntries.length });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getMyRatedTransactionIds = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const ids = await Rating.distinct('transactionId', {
      customerId: new mongoose.Types.ObjectId(customerId),
      transactionId: { $ne: null },
    });
    res.json({ ratedTransactionIds: ids.map(String) });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getMyProductRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const ratings = await Rating.find({
      customerId: new mongoose.Types.ObjectId(customerId),
      type: 'product',
      productId: { $ne: null },
    })
      .select('productId stars comment')
      .lean();

    res.json(
      ratings.map((r) => ({
        productId: String(r.productId),
        stars: r.stars,
        comment: r.comment ?? '',
      }))
    );
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getMyStoreRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    const { storeId } = req.query as { storeId?: string };
    if (!customerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }
    const existing = await Rating.findOne({
      storeId: new mongoose.Types.ObjectId(storeId),
      customerId: new mongoose.Types.ObjectId(customerId),
      type: 'store',
      transactionId: null,
    }).lean();
    res.json({ rating: existing ?? null });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, limit = '50', page = '1' } = req.query as Record<string, string>;
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const lim = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = (parseInt(page, 10) - 1) * lim;

    const ratings = await Rating.find({ storeId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('customerId', 'name')
      .populate('productId', 'name')
      .lean();

    res.json(ratings);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

const buildOverallAgg = async (storeObjId: mongoose.Types.ObjectId, type: 'product' | 'store') => {
  const rows = await Rating.aggregate([
    { $match: { storeId: storeObjId, type } },
    {
      $group: {
        _id: null,
        averageStars: { $avg: '$stars' },
        totalCount: { $sum: 1 },
        dist1: { $sum: { $cond: [{ $eq: ['$stars', 1] }, 1, 0] } },
        dist2: { $sum: { $cond: [{ $eq: ['$stars', 2] }, 1, 0] } },
        dist3: { $sum: { $cond: [{ $eq: ['$stars', 3] }, 1, 0] } },
        dist4: { $sum: { $cond: [{ $eq: ['$stars', 4] }, 1, 0] } },
        dist5: { $sum: { $cond: [{ $eq: ['$stars', 5] }, 1, 0] } },
      },
    },
  ]);
  const r = rows[0] ?? { averageStars: 0, totalCount: 0, dist1: 0, dist2: 0, dist3: 0, dist4: 0, dist5: 0 };
  return {
    averageStars: Number((r.averageStars ?? 0).toFixed(1)),
    totalCount: r.totalCount as number,
    distribution: { 1: r.dist1, 2: r.dist2, 3: r.dist3, 4: r.dist4, 5: r.dist5 } as Record<number, number>,
  };
};

export const getRatingAggregates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.query as { storeId?: string };
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const storeObjId = new mongoose.Types.ObjectId(storeId);

    const [productOverall, storeOverall] = await Promise.all([
      buildOverallAgg(storeObjId, 'product'),
      buildOverallAgg(storeObjId, 'store'),
    ]);

    // Per-product averages
    const perProduct = await Rating.aggregate([
      { $match: { storeId: storeObjId, type: 'product', productId: { $ne: null } } },
      {
        $group: {
          _id: '$productId',
          averageStars: { $avg: '$stars' },
          totalCount: { $sum: 1 },
        },
      },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
      { $project: { productId: '$_id', productName: '$product.name', averageStars: 1, totalCount: 1 } },
      { $sort: { averageStars: -1 } },
    ]);

    // All product ratings (with or without comments) so every reviewer appears in the modal
    const recentProductFeedback = await Rating.find({ storeId, type: 'product' })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('customerId', 'name')
      .populate('productId', 'name')
      .lean();

    // Recent store comments
    const recentStoreFeedback = await Rating.find({ storeId, type: 'store', comment: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('customerId', 'name')
      .lean();

    res.json({
      product: {
        overall: productOverall,
        perProduct,
        recentFeedback: recentProductFeedback,
      },
      store: {
        overall: storeOverall,
        recentFeedback: recentStoreFeedback,
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getProductRatingInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.user?.userId;
    if (!customerId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { productId } = req.query as { productId?: string };
    if (!productId) {
      res.status(400).json({ message: 'productId is required' });
      return;
    }

    const product = await Product.findById(productId)
      .select('name images sellingPrice discountPrice storeId stockQuantity')
      .lean();
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const [hasPurchased, existingRating] = await Promise.all([
      customerHasPurchased(customerId, productId),
      Rating.findOne({
        productId: new mongoose.Types.ObjectId(productId),
        customerId: new mongoose.Types.ObjectId(customerId),
        type: 'product',
      }).select('stars comment createdAt').lean(),
    ]);

    // Eligible if purchased at least once — one purchase = always allowed to rate/update
    const isEligible = hasPurchased;

    res.json({
      product: {
        _id: String(product._id),
        name: product.name,
        images: product.images ?? [],
        sellingPrice: product.sellingPrice,
        discountPrice: product.discountPrice ?? null,
        storeId: String(product.storeId),
      },
      isEligible,
      existingRating: existingRating
        ? {
            stars: existingRating.stars,
            comment: existingRating.comment ?? '',
            ratedAt: existingRating.createdAt,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
