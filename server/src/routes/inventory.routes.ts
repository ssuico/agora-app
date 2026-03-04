import { Router, type Router as IRouter } from 'express';
import {
  getDailyInventory,
  restockProduct,
} from '../controllers/inventory.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const inventoryRoutes: IRouter = Router();

inventoryRoutes.use(authenticate);

inventoryRoutes.get(
  '/daily',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  getDailyInventory
);

inventoryRoutes.patch(
  '/daily/:productId/restock',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  restockProduct
);
