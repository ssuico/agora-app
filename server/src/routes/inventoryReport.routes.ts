import { Router, type Router as IRouter } from 'express';
import {
  deleteReport,
  downloadReport,
  exportReport,
  generateReport,
  getReports,
} from '../controllers/inventoryReport.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const inventoryReportRoutes: IRouter = Router();

inventoryReportRoutes.use(authenticate);

inventoryReportRoutes.get(
  '/',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  getReports
);
inventoryReportRoutes.get(
  '/export',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  exportReport
);
inventoryReportRoutes.post(
  '/generate',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  generateReport
);
inventoryReportRoutes.get(
  '/:id/download',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  downloadReport
);
inventoryReportRoutes.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  deleteReport
);
