// socket.ts
// We create ONE socket instance and export it.
// If every component created its own socket, you'd have
// dozens of redundant connections. One singleton = one connection.

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SOCKET_URL, {
  autoConnect: false, // We connect manually when a user joins a poll room
  transports: ['websocket'], // Skip long-polling, go straight to WebSocket
});