import { io } from "socket.io-client";

// This will use the cloud URL in production, and localhost during development
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "https://pollview-backend.onrender.com";

export const socket = io(SOCKET_URL, {
  transports: ["websocket", "polling"], // Ensure websocket is preferred
});