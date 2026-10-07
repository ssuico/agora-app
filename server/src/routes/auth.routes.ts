import { Router, type RequestHandler, type Router as IRouter } from 'express';
import rateLimit from 'express-rate-limit';
import { isEmailVerificationEnabled } from '../config/authFeatures.js';
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

// Every accepted request on these routes can send an email, so they get a tighter cap than login.
const emailSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many email requests. Please try again later.' },
});

const emailSendLimiterWhenEnabled: RequestHandler = (req, res, next) =>
  isEmailVerificationEnabled() ? emailSendLimiter(req, res, next) : next();

authRoutes.post('/login', sensitiveAuthLimiter, login);
authRoutes.post('/logout', logout);
authRoutes.get('/options', getAuthOptions);
authRoutes.post('/signup', sensitiveAuthLimiter, emailSendLimiterWhenEnabled, signup);
authRoutes.post('/signup/code', sensitiveAuthLimiter, emailSendLimiter, sendSignupCode);
authRoutes.post('/signup/confirm', sensitiveAuthLimiter, confirmSignup);
authRoutes.post('/forgot-password/code', sensitiveAuthLimiter, emailSendLimiter, sendPasswordResetCode);
authRoutes.post('/forgot-password/confirm', sensitiveAuthLimiter, confirmPasswordReset);
authRoutes.post('/register', sensitiveAuthLimiter, authenticate, authorize(UserRole.ADMIN), register);
authRoutes.get('/me', authenticate, getMe);
authRoutes.patch('/me', authenticate, updateProfile);
authRoutes.post('/switch-role', authenticate, switchRole);
authRoutes.post('/reset-password', sensitiveAuthLimiter, authenticate, resetPassword);
