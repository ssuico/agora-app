import { Router, type Router as IRouter } from 'express';
import {
  createLocation,
  deleteLocation,
  getLocation,
  getLocations,
  updateLocation,
} from '../controllers/location.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const locationRoutes: IRouter = Router();

locationRoutes.use(authenticate);

locationRoutes.get('/', getLocations);
locationRoutes.get('/:id', getLocation);
locationRoutes.post('/', authorize(UserRole.ADMIN), createLocation);
locationRoutes.put('/:id', authorize(UserRole.ADMIN), updateLocation);
locationRoutes.delete('/:id', authorize(UserRole.ADMIN), deleteLocation);
