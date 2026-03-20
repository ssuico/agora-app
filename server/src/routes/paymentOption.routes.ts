import { Router, type Router as IRouter } from 'express';
import {
  createPaymentOption,
  deletePaymentOption,
  getActivePaymentOptionsByStore,
  getPaymentOptionsByStore,
  updatePaymentOption,
} from '../controllers/paymentOption.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { enforceStoreAccess } from '../middleware/storeScope.js';
import { UserRole } from '../types/index.js';

export const paymentOptionRoutes: IRouter = Router();

paymentOptionRoutes.use(authenticate);

// Customers and managers can view active payment options for a store
paymentOptionRoutes.get(
  '/store/:storeId/active',
  getActivePaymentOptionsByStore
);

// Managers (and admin) can view all payment options for their store
paymentOptionRoutes.get(
  '/store/:storeId',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  enforceStoreAccess,
  getPaymentOptionsByStore
);

// Managers can create payment options for their store
paymentOptionRoutes.post(
  '/store/:storeId',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  enforceStoreAccess,
  createPaymentOption
);

// Managers can update or delete their store's payment options
paymentOptionRoutes.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  updatePaymentOption
);

paymentOptionRoutes.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  deletePaymentOption
);
