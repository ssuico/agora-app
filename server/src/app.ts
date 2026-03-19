import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { activityRoutes } from './routes/activity.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { expenseRoutes } from './routes/expense.routes.js';
import { interactionRoutes } from './routes/interaction.routes.js';
import { inventoryReportRoutes } from './routes/inventoryReport.routes.js';
import { inventoryRoutes } from './routes/inventory.routes.js';
import { locationRoutes } from './routes/location.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { ratingRoutes } from './routes/rating.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { storeRoutes } from './routes/store.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { transactionReportRoutes } from './routes/transactionReport.routes.js';
import { userRoutes } from './routes/user.routes.js';

export const app: Express = express();

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
const isDev = process.env.NODE_ENV !== 'production';
app.use(
  cors({
    // In dev allow any origin so LAN clients (network IP) work without configuration.
    // In production restrict to the explicit CLIENT_URL.
    origin: isDev ? true : (process.env.CLIENT_URL ?? 'http://localhost:4321'),
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Strict limit only for sensitive auth actions (login, register, reset-password).
// GET /me and PATCH /me are not limited here so normal app usage (layout + profile) doesn't hit 429.
app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory-reports', inventoryReportRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/transaction-reports', transactionReportRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/activity-logs', activityRoutes);

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
