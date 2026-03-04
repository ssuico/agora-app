import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_API_URL
    ? import.meta.env.PUBLIC_API_URL
    : 'http://localhost:3001';

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}
