import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { toLocalDateStr } from '../config/timezone.js';
import { InventoryRecord } from '../models/InventoryRecord.js';
import { Product } from '../models/Product.js';
import { TransactionItem } from '../models/TransactionItem.js';
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

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    const dailyOnly = req.query.dailyOnly === 'true';

    if (req.user!.role === UserRole.STORE_MANAGER && !storeId) {
      const products = await Product.find({ storeId: { $in: req.user!.storeIds ?? [] } }).sort({
        createdAt: -1,
      });
      res.json(products);
      return;
    }

    const filter = storeId ? { storeId } : {};
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

    const payload = {
      ...req.body,
      sellingPrice,
      ...(discountPrice !== undefined ? { discountPrice } : {}),
    };

    const product = await Product.create(payload);

    const today = new Date(toLocalDateStr(new Date()));
    today.setUTCHours(0, 0, 0, 0);
    await InventoryRecord.create({
      productId: product._id,
      storeId: product.storeId,
      date: today,
      initialStock: product.stockQuantity,
      restock: 0,
    }).catch(() => {});

    res.status(201).json(product);
  } catch (err) {
    if (sendValidationError(res, err)) return;
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stockQuantity, ...updateData } = req.body;
    const discountPrice = normalizeDiscountPrice(updateData.discountPrice);
    if (Number.isNaN(discountPrice)) {
      res.status(400).json({ message: 'Discount price must be a valid number' });
      return;
    }
    if (discountPrice !== undefined) {
      updateData.discountPrice = discountPrice;
    }

    const existingProduct = await Product.findById(req.params.id).select('sellingPrice discountPrice');
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
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const getProductsSoldStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;
    if (!storeId) {
      res.status(400).json({ message: 'storeId is required' });
      return;
    }

    const products = await Product.find({ storeId }).select('_id').lean();
    const productIds = products.map((p) => p._id);

    const stats = await TransactionItem.aggregate([
      { $match: { productId: { $in: productIds } } },
      { $group: { _id: '$productId', totalSold: { $sum: '$quantity' } } },
    ]);

    const soldMap: Record<string, number> = {};
    for (const s of stats) {
      soldMap[String(s._id)] = s.totalSold;
    }

    res.json(soldMap);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};
