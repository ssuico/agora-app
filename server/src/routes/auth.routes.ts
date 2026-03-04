import { Router, type Router as IRouter } from 'express';
import { getMe, login, logout, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const authRoutes: IRouter = Router();

authRoutes.post('/login', login);
authRoutes.post('/logout', logout);
authRoutes.post('/register', authenticate, authorize(UserRole.ADMIN), register);
authRoutes.get('/me', authenticate, getMe);
