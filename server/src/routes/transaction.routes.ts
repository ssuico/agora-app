import { Router, type Router as IRouter } from 'express';
import {
  cancelTransaction,
  createTransaction,
  deleteTransaction,
  getMyPurchases,
  getTransaction,
  getTransactions,
  requestCancellation,
  resolveCancellationRequest,
  updateTransactionCustomer,
  updateTransactionNotes,
  updateTransactionStatus,
} from '../controllers/transaction.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const transactionRoutes: IRouter = Router();

transactionRoutes.use(authenticate);

transactionRoutes.get('/my-purchases', authorize(UserRole.CUSTOMER), getMyPurchases);
transactionRoutes.get('/', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), getTransactions);
transactionRoutes.get('/:id', getTransaction);
transactionRoutes.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER, UserRole.CUSTOMER),
  createTransaction
);
transactionRoutes.patch(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  updateTransactionStatus
);
transactionRoutes.patch(
  '/:id/customer',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  updateTransactionCustomer
);
transactionRoutes.patch(
  '/:id/notes',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  updateTransactionNotes
);
transactionRoutes.patch(
  '/:id/cancel',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  cancelTransaction
);
transactionRoutes.post(
  '/:id/cancel-request',
  authorize(UserRole.CUSTOMER),
  requestCancellation
);
transactionRoutes.patch(
  '/:id/cancel-request',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  resolveCancellationRequest
);
transactionRoutes.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  deleteTransaction
);
