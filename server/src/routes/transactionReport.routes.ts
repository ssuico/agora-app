import { Router, type Router as IRouter } from 'express';
import {
  deleteReport,
  downloadReport,
  generateReport,
  getReports,
} from '../controllers/transactionReport.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const transactionReportRoutes: IRouter = Router();

transactionReportRoutes.use(authenticate);

transactionReportRoutes.post(
  '/generate',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  generateReport
);
transactionReportRoutes.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  getReports
);
transactionReportRoutes.get(
  '/:id/download',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  downloadReport
);
transactionReportRoutes.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  deleteReport
);
