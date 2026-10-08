import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { toLocalDateStr } from '../config/timezone.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { PreOrderListing } from '../models/PreOrderListing.js';
import { Product, REGULAR_PRODUCT_FILTER, type ProductType } from '../models/Product.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { cutoffError, parseExpectedDate, parsePreOrderClosesAt } from '../services/preorderWindow.js';
import { UserRole } from '../types/index.js';

const normalizeDiscountPrice = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const toFiniteNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const sendValidationError = (res: Response, err: unknown): boolean => {
  if (err instanceof mongoose.Error.ValidationError) {
    const firstIssue = Object.values(err.errors)[0];
    res.status(400).json({ message: firstIssue?.message ?? 'Invalid product data' });
    return true;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: `Invalid value for ${err.path}` });
    return true;
  }
  return false;
};

/** Default listing is regular inventory. `preorder` and `all` are explicit. */
function productTypeFilter(productType: string | undefined): Record<string, unknown> {
  if (productType === 'all') return {};
  if (productType === 'preorder') return { productType: 'preorder' };
  return { ...REGULAR_PRODUCT_FILTER };
}

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const dailyOnly = req.query.dailyOnly === 'true';
    const typeFilter = productTypeFilter(req.query.productType as string | undefined);

    if (req.user!.role === UserRole.STORE_MANAGER && !storeId) {
      const products = await Product.find({
        storeId: { $in: req.user!.storeIds ?? [] },
        ...typeFilter,
      }).sort({
        createdAt: -1,
      });
      res.json(products);
      return;
    }

    const filter = storeId ? { storeId, ...typeFilter } : { ...typeFilter };
    const products = await Product.find(filter).sort({ createdAt: -1 });

    if (dailyOnly && storeId) {
      const today = new Date(toLocalDateStr(new Date()));
      today.setUTCHours(0, 0, 0, 0);

      const dailyRecords = await InventoryRecord.find({
        storeId,
        date: today,
      })
        .select('productId')
        .lean();

      const dailyProductIds = new Set(dailyRecords.map((r) => String(r.productId)));
      const filtered = products.filter((p) => dailyProductIds.has(String(p._id)));
      res.json(filtered);
      return;
    }

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const sellingPrice = toFiniteNumber(req.body.sellingPrice);
    if (sellingPrice === undefined || sellingPrice < 0) {
      res.status(400).json({ message: 'Selling price must be a valid non-negative number' });
      return;
    }

    const discountPrice = normalizeDiscountPrice(req.body.discountPrice);
    if (Number.isNaN(discountPrice)) {
      res.status(400).json({ message: 'Discount price must be a valid number' });
      return;
    }
    if (typeof discountPrice === 'number' && discountPrice > sellingPrice) {
      res.status(400).json({ message: 'Discount price cannot be greater than selling price' });
      return;
    }

    const isPreOrder = req.body.productType === 'preorder';
    const productType: ProductType = isPreOrder ? 'preorder' : 'regular';

    let preOrderClosesAt: Date | null = null;
    let preOrderExpectedDate: Date | null | undefined;
    if (isPreOrder) {
      const closes = parsePreOrderClosesAt(req.body.preOrderClosesAt);
      if (!closes.ok) {
        res.status(400).json({ message: closes.message });
        return;
      }
      const expected = parseExpectedDate(req.body.preOrderExpectedDate);
      if (!expected.ok) {
        res.status(400).json({ message: expected.message });
        return;
      }
      const windowError = cutoffError(closes.date, expected.date, { required: true, requireFuture: true });
      if (windowError) {
        res.status(400).json({ message: windowError });
        return;
      }
      preOrderClosesAt = closes.date;
      preOrderExpectedDate = expected.date;
    }

    const payload = {
      ...req.body,
      sellingPrice,
      productType,
      ...(discountPrice !== undefined ? { discountPrice } : {}),
      ...(isPreOrder ? { stockQuantity: 0, preOrderClosesAt, preOrderExpectedDate } : {}),
    };

    const product = await Product.create(payload);

    if (isPreOrder) {
      await PreOrderListing.create({
        productId: product._id,
        storeId: product.storeId,
        listedAt: new Date(),
        unlistedAt: null,
      });
    } else {
      const today = new Date(toLocalDateStr(new Date()));
      today.setUTCHours(0, 0, 0, 0);
      await InventoryRecord.create({
        productId: product._id,
        storeId: product.storeId,
        date: today,
        initialStock: product.stockQuantity,
        restock: 0,
      }).catch(() => {});
    }

    res.status(201).json(product);
  } catch (err) {
    if (sendValidationError(res, err)) return;
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stockQuantity: _stockQuantity, productType: _productType, ...updateData } = req.body;
    const discountPrice = normalizeDiscountPrice(updateData.discountPrice);
    if (Number.isNaN(discountPrice)) {
      res.status(400).json({ message: 'Discount price must be a valid number' });
      return;
    }
    if (discountPrice !== undefined) {
      updateData.discountPrice = discountPrice;
    }

    const existingProduct = await Product.findById(req.params.id).select(
      'sellingPrice discountPrice productType preOrderExpectedDate preOrderClosesAt'
    );
    if (!existingProduct) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    const requestedSellingPrice = toFiniteNumber(updateData.sellingPrice);
    if (updateData.sellingPrice !== undefined && requestedSellingPrice === undefined) {
      res.status(400).json({ message: 'Selling price must be a valid number' });
      return;
    }
    const nextSellingPrice = requestedSellingPrice ?? existingProduct.sellingPrice;
    const nextDiscountPrice =
      updateData.discountPrice !== undefined ? updateData.discountPrice : existingProduct.discountPrice;

    if (typeof nextDiscountPrice === 'number' && nextDiscountPrice > nextSellingPrice) {
      res.status(400).json({ message: 'Discount price cannot be greater than selling price' });
      return;
    }

    if (requestedSellingPrice !== undefined) {
      updateData.sellingPrice = requestedSellingPrice;
    }

    let nextExpected = existingProduct.preOrderExpectedDate ?? null;
    if (updateData.preOrderExpectedDate === '' || updateData.preOrderExpectedDate === null) {
      nextExpected = null;
      updateData.preOrderExpectedDate = null;
    } else if (updateData.preOrderExpectedDate !== undefined) {
      const expected = parseExpectedDate(updateData.preOrderExpectedDate);
      if (!expected.ok) {
        res.status(400).json({ message: expected.message });
        return;
      }
      nextExpected = expected.date;
      updateData.preOrderExpectedDate = expected.date;
    }

    let nextCloses = existingProduct.preOrderClosesAt ?? null;
    if (updateData.preOrderClosesAt === '' || updateData.preOrderClosesAt === null) {
      nextCloses = null;
      updateData.preOrderClosesAt = null;
    } else if (updateData.preOrderClosesAt !== undefined) {
      const closes = parsePreOrderClosesAt(updateData.preOrderClosesAt);
      if (!closes.ok) {
        res.status(400).json({ message: closes.message });
        return;
      }
      nextCloses = closes.date;
      updateData.preOrderClosesAt = closes.date;
    }

    if (existingProduct.productType === 'preorder') {
      const windowError = cutoffError(nextCloses, nextExpected, { required: false, requireFuture: false });
      if (windowError) {
        res.status(400).json({ message: windowError });
        return;
      }
    }

    if (
      updateData.preOrderStatus !== undefined &&
      updateData.preOrderStatus !== 'pending' &&
      updateData.preOrderStatus !== 'ready'
    ) {
      res.status(400).json({ message: 'Invalid pre-order status' });
      return;
    }

    if (updateData.preOrderOpen !== undefined) {
      updateData.preOrderOpen = Boolean(updateData.preOrderOpen);
    }

    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
      context: 'query',
    });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.json(product);
  } catch (err) {
    if (sendValidationError(res, err)) return;
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (product) {
      await PreOrderListing.deleteMany({ productId: product._id });
    }
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getProductsSoldStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, limit: limitParam = '10' } = req.query as Record<string, string>;
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const parsedLimit = parseInt(limitParam, 10);
    const lim = parsedLimit === 0 ? 0 : Math.min(parsedLimit || 10, 50);

    const products = await Product.find({ storeId, ...REGULAR_PRODUCT_FILTER }).select('_id').lean();
    const productIds = products.map((p) => p._id);

    const pipeline: mongoose.PipelineStage[] = [
      { $match: { productId: { $in: productIds } } },
      {
        $group: {
          _id: '$productId',
          totalSold: { $sum: '$quantity' },
          totalRevenue: { $sum: '$subtotal' },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: false } },
      {
        $project: {
          productId: '$_id',
          name: '$product.name',
          totalSold: 1,
          totalRevenue: 1,
        },
      },
      { $sort: { totalSold: -1 } },
    ];
    if (lim > 0) pipeline.push({ $limit: lim });

    const stats = await TransactionItem.aggregate(pipeline);

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
