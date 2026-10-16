import { Router, type Router as IRouter } from 'express';
import {
  createSheet,
  deleteSheet,
  exportSheets,
  listSheets,
  updateSheet,
} from '../controllers/storeSheet.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { enforceStoreAccess } from '../middleware/storeScope.js';
import { UserRole } from '../types/index.js';

export const storeSheetRoutes: IRouter = Router();

storeSheetRoutes.use(authenticate);

storeSheetRoutes.get(
  '/store/:storeId',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  enforceStoreAccess,
  listSheets
);

storeSheetRoutes.post(
  '/store/:storeId',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  enforceStoreAccess,
  createSheet
);

storeSheetRoutes.post(
  '/export/store/:storeId',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  enforceStoreAccess,
  exportSheets
);

storeSheetRoutes.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  updateSheet
);

storeSheetRoutes.delete(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  deleteSheet
);
