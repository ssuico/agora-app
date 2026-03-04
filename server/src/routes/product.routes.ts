import { Router, type Router as IRouter } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  getProducts,
  getProductsSoldStats,
  updateProduct,
} from '../controllers/product.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { enforceStoreAccess } from '../middleware/storeScope.js';
import { UserRole } from '../types/index.js';

export const productRoutes: IRouter = Router();

productRoutes.use(authenticate);

productRoutes.get('/sold-stats', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), getProductsSoldStats);
productRoutes.get('/', getProducts);
productRoutes.get('/:id', getProduct);
productRoutes.post('/', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), enforceStoreAccess, createProduct);
productRoutes.put('/:id', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), updateProduct);
productRoutes.delete('/:id', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), deleteProduct);
