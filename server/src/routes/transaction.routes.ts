import { Router, type Router as IRouter } from 'express';
import {
  createTransaction,
  getMyPurchases,
  getTransaction,
  getTransactions,
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
