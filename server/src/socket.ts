import { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL ?? '*',
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    socket.on('join:store', (storeId: string) => {
      socket.join(`store:${storeId}`);
    });

    socket.on('leave:store', (storeId: string) => {
      socket.leave(`store:${storeId}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}
