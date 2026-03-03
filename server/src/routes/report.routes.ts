import { Router, type Router as IRouter } from 'express';
import { getDailyReport, getSummary } from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const reportRoutes: IRouter = Router();

reportRoutes.use(authenticate);

reportRoutes.get('/summary', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), getSummary);
reportRoutes.get('/daily', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), getDailyReport);
