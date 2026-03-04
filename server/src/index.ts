import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import 'dotenv/config';
import { createServer } from 'node:http';
import { connectDB } from './config/db.js';
import { app } from './app.js';
import { initSocket } from './socket.js';

const PORT = process.env.PORT ?? 3001;

connectDB()
  .then(() => {
    const httpServer = createServer(app);
    initSocket(httpServer);

    httpServer.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
