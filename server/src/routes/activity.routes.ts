import { Router, type Router as IRouter } from 'express';
import { getActivityLogs } from '../controllers/activity.controller.js';
import { authenticate } from '../middleware/auth.js';

export const activityRoutes: IRouter = Router();

activityRoutes.use(authenticate);

activityRoutes.get('/', getActivityLogs);
