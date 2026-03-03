import cors from 'cors';
import express, { type Express } from 'express';
import { authRoutes } from './routes/auth.routes.js';
import { expenseRoutes } from './routes/expense.routes.js';
import { locationRoutes } from './routes/location.routes.js';
import { productRoutes } from './routes/product.routes.js';
import { reportRoutes } from './routes/report.routes.js';
import { storeRoutes } from './routes/store.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { userRoutes } from './routes/user.routes.js';

export const app: Express = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL ?? '*',
    credentials: true,
  })
);
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
