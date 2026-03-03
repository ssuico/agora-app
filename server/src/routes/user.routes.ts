import { Router, type Router as IRouter } from 'express';
import { deleteUser, getUser, getUserAssignments, getUsers } from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const userRoutes: IRouter = Router();

userRoutes.use(authenticate, authorize(UserRole.ADMIN));

userRoutes.get('/', getUsers);
userRoutes.get('/:id', getUser);
userRoutes.get('/:id/assignments', getUserAssignments);
userRoutes.delete('/:id', deleteUser);
