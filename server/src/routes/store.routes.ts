import { Router, type Router as IRouter } from 'express';
import {
  assignManager,
  createStore,
  deleteStore,
  getStore,
  getStoreManagers,
  getStores,
  getStoresByLocation,
  unassignManager,
  updateStore,
} from '../controllers/store.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const storeRoutes: IRouter = Router();

storeRoutes.use(authenticate);

storeRoutes.get('/', getStores);
storeRoutes.get('/by-location/:locationId', getStoresByLocation);
storeRoutes.get('/:id', getStore);
storeRoutes.post('/', authorize(UserRole.ADMIN), createStore);
storeRoutes.put('/:id', authorize(UserRole.ADMIN), updateStore);
storeRoutes.delete('/:id', authorize(UserRole.ADMIN), deleteStore);

storeRoutes.post('/:id/assign-manager', authorize(UserRole.ADMIN), assignManager);
storeRoutes.post('/:id/unassign-manager', authorize(UserRole.ADMIN), unassignManager);
storeRoutes.get('/:id/managers', authorize(UserRole.ADMIN), getStoreManagers);
