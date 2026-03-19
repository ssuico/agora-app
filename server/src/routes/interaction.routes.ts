import { Router, type Router as IRouter } from 'express';
import {
  createInteraction,
  getInteractions,
  updateInteractionStatus,
} from '../controllers/interaction.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const interactionRoutes: IRouter = Router();

interactionRoutes.use(authenticate);

interactionRoutes.post('/', createInteraction);
interactionRoutes.get('/', authorize(UserRole.ADMIN, UserRole.STORE_MANAGER), getInteractions);
interactionRoutes.patch(
  '/:id/status',
  authorize(UserRole.ADMIN, UserRole.STORE_MANAGER),
  updateInteractionStatus
);
