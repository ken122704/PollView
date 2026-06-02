# 📊 PollView

> A highly concurrent, distributed real-time polling application engineered to handle massive scale with zero data loss.

PollView is a full-stack application designed to demonstrate Parallel and Distributed Computing (PDC) principles. It guarantees zero-refresh, sub-second vote synchronization for thousands of concurrent users. By utilizing a stateless backend, Redis-backed task queues, and an application-level Mutex, the architecture entirely prevents database race conditions during extreme traffic spikes.

## 🚀 Live Environment

- **Frontend App:** [https://poll-view-client.vercel.app/](https://poll-view-client.vercel.app/)
- **Architecture:** Vercel (Edge UI) ↔ Render (Node.js/Sockets) ↔ Upstash (Redis/BullMQ)

---

## ✨ Core Features

- **Zero-Refresh Synchronization:** Full-duplex WebSocket connections broadcast vote updates to all connected clients in milliseconds.
- **Absolute Data Integrity:** An Application-Level Mutex paired with a BullMQ worker queue serializes concurrent requests, preventing Read-Modify-Write race conditions.
- **Stateless Architecture:** The Node.js application stores zero state locally. All data is managed by an external Redis cluster, allowing for infinite horizontal scaling.
- **State Persistence:** Gracefully handles unexpected client disconnects and page refreshes without requiring complex user authentication.

---

## 🛠️ Tech Stack

**Frontend**

- **React + Vite:** For lightning-fast UI rendering and local development.
- **TypeScript:** Enforcing strict type safety across the entire application.
- **Tailwind CSS:** Utility-first styling for a clean, responsive interface.
- **Socket.io-client:** Maintaining the persistent TCP connection to the backend.
- **Recharts:** Rendering dynamic, real-time data visualizations.

**Backend & Distributed Systems**

- **Node.js + Express:** Handling REST API health checks and WebSocket upgrades.
- **Socket.io:** Managing rooms, event broadcasting, and connection fallbacks.
- **Upstash Redis:** Cloud-based, in-memory data store for sub-millisecond read/writes.
- **BullMQ:** Robust message broker and worker queue to protect the Node event loop under heavy load.

---

## 🏗️ System Architecture

1.  **The Client:** Users join a specific poll room. The initial load uses a standard HTTP GET request, which instantly upgrades to a WebSocket connection.
2.  **The Event:** When 1,000 users click "Vote" simultaneously, the frontend emits a socket event to the server.
3.  **The Queue:** The stateless Node.js server receives the burst and pushes the payloads into a Redis-backed BullMQ queue to prevent memory overflow.
4.  **The Mutex:** A background worker picks up tasks sequentially. It acquires a cryptographic lock on the specific `poll_id`, updates the total, releases the lock, and broadcasts the new state.
5.  **The Broadcast:** Socket.io pushes the updated Redis state to all clients in the isolated room, animating the frontend charts.
