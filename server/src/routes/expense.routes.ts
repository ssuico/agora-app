import { Router, type Router as IRouter } from 'express';
import {
  createExpense,
  deleteExpense,
  getExpenses,
  updateExpense,
} from '../controllers/expense.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const expenseRoutes: IRouter = Router();

expenseRoutes.use(authenticate);

expenseRoutes.get('/', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), getExpenses);
expenseRoutes.post('/', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), createExpense);
expenseRoutes.put('/:id', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), updateExpense);
expenseRoutes.delete('/:id', authorize(UserRole.ADMIN), deleteExpense);
