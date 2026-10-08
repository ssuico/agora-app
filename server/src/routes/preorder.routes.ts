import { Router, type Router as IRouter } from 'express';
import {
  getPreOrderHistory,
  getPreOrderOrders,
  getPreOrders,
  relistPreOrder,
  unlistPreOrder,
} from '../controllers/preorder.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { enforceStoreAccess } from '../middleware/storeScope.js';
import { UserRole } from '../types/index.js';

export const preorderRoutes: IRouter = Router();

preorderRoutes.use(authenticate);

preorderRoutes.get('/', enforceStoreAccess, getPreOrders);
preorderRoutes.get(
  '/history',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  enforceStoreAccess,
  getPreOrderHistory
);
preorderRoutes.post(
  '/:productId/unlist',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  unlistPreOrder
);
preorderRoutes.post(
  '/:productId/relist',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  relistPreOrder
);
preorderRoutes.get(
  '/:productId/orders',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  getPreOrderOrders
);
