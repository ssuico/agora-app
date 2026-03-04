import { Request, Response } from 'express';
import { Product } from '../models/Product.js';
import { TransactionItem } from '../models/TransactionItem.js';
import { UserRole } from '../types/index.js';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string | undefined;

    if (req.user!.role === UserRole.STORE_MANAGER && !storeId) {
      const products = await Product.find({ storeId: { $in: req.user!.storeIds ?? [] } }).sort({
        createdAt: -1,
      });
      res.json(products);
      return;
    }

    const filter = storeId ? { storeId } : {};
    const products = await Product.find(filter).sort({ createdAt: -1 });
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
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { stockQuantity, ...updateData } = req.body;
    const product = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
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
