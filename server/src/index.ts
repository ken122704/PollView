import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { initSocket } from './socket';

dotenv.config();

const app = express();

app.get('/health', (req, res) => {
    res.status(200).send('PollView Backend is awake and healthy!');
});

const httpServer = http.createServer(app);

// --- Middleware ---
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

// --- Health Check Endpoint ---
// This is the first thing your professor can hit to prove the server is alive.
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// --- Socket.io bootstrap ---
initSocket(httpServer);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});