import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  const dns = await import('node:dns');
  dns.setDefaultResultOrder('ipv4first');
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}

import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import { app } from './app.js';
import { initSocket } from './socket.js';

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST ?? '0.0.0.0';

connectDB()
  .then(() => {
    const httpServer = createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT} [${isProd ? 'production' : 'development'}]`);
    });

    const shutdown = (signal: string) => {
      console.log(`\n${signal} received — shutting down gracefully...`);
      httpServer.close(() => {
        mongoose.connection.close(false).then(() => {
          console.log('MongoDB connection closed.');
          process.exit(0);
        });
      });
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
