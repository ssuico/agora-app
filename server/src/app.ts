import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authRoutes } from './routes/auth.routes.js';
import { expenseRoutes } from './routes/expense.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { locationRoutes } from './routes/location.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { storeRoutes } from './routes/store.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { transactionReportRoutes } from './routes/transactionReport.routes.js';
import { userRoutes } from './routes/user.routes.js';

export const app: Express = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? 'http://localhost:4321',
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transaction-reports', transactionReportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

app.get('/health', async (_req, res) => {
  const mongoose = await import('mongoose');
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  res.status(dbState === 1 ? 200 : 503).json({
    status: dbState === 1 ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    db: dbStatus,
  });
});
