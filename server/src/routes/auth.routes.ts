import { Router, type Router as IRouter } from 'express';
import rateLimit from 'express-rate-limit';
import {
  confirmPasswordReset,
  confirmSignup,
  getAuthOptions,
  getMe,
  login,
  logout,
  register,
  resetPassword,
  sendPasswordResetCode,
  sendSignupCode,
  signup,
  switchRole,
  updateProfile,
} from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/role.js';
import { UserRole } from '../types/index.js';

export const authRoutes: IRouter = Router();

const sensitiveAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});

authRoutes.post('/login', sensitiveAuthLimiter, login);
authRoutes.post('/logout', logout);
authRoutes.get('/options', getAuthOptions);
authRoutes.post('/signup', sensitiveAuthLimiter, signup);
authRoutes.post('/signup/code', sensitiveAuthLimiter, sendSignupCode);
authRoutes.post('/signup/confirm', sensitiveAuthLimiter, confirmSignup);
authRoutes.post('/forgot-password/code', sensitiveAuthLimiter, sendPasswordResetCode);
authRoutes.post('/forgot-password/confirm', sensitiveAuthLimiter, confirmPasswordReset);
authRoutes.post('/register', sensitiveAuthLimiter, authenticate, authorize(UserRole.ADMIN), register);
authRoutes.get('/me', authenticate, getMe);
authRoutes.patch('/me', authenticate, updateProfile);
authRoutes.post('/switch-role', authenticate, switchRole);
authRoutes.post('/reset-password', sensitiveAuthLimiter, authenticate, resetPassword);
