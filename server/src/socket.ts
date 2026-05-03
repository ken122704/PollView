import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import {
  castVote,
  getPoll,
  getAllPolls,
  seedDefaultPoll,
  createPoll,
} from './pollStore';
import { addAnalysisJob } from './queue';

// Seed data on startup so there's always something to vote on
const defaultPoll = seedDefaultPoll();
console.log(`📊 Default poll created: ${defaultPoll.id}`);

export function initSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ── JOIN POLL ROOM ──────────────────────────────────────────────
    // Socket.io "rooms" let us broadcast ONLY to users watching a specific poll.
    // This is how you avoid sending Poll A's updates to Poll B's viewers.
    socket.on('join_poll', (pollId: string) => {
      socket.join(pollId);
      const poll = getPoll(pollId);
      if (poll) {
        // Send current poll state immediately to the joining user only
        socket.emit('poll_state', poll);
        console.log(`👤 ${socket.id} joined room: ${pollId}`);
      } else {
        socket.emit('error_message', `Poll ${pollId} not found`);
      }
    });

    // ── CAST VOTE ───────────────────────────────────────────────────
    socket.on(
      'cast_vote',
      async (payload: { pollId: string; optionId: string }) => {
        const { pollId, optionId } = payload;

        // castVote uses a mutex — concurrent calls queue up here safely
        const updatedPoll = await castVote(pollId, optionId);

        if (updatedPoll) {
          // Broadcast updated poll to EVERYONE in this poll's room
          // This is the "real-time" magic — no refresh needed
          io.to(pollId).emit('poll_update', updatedPoll);
        } else {
          socket.emit('error_message', 'Vote failed: invalid poll or option');
        }
      }
    );

    // ── GET ALL POLLS ───────────────────────────────────────────────
    socket.on('get_polls', () => {
      socket.emit('polls_list', getAllPolls());
    });

    // ── ANALYZE RESULTS ─────────────────────────────────────────────
    // This offloads heavy work to the BullMQ worker — Phase 5's core concept
    socket.on('analyze_poll', async (pollId: string) => {
      const poll = getPoll(pollId);
      if (!poll) {
        socket.emit('error_message', 'Poll not found for analysis');
        return;
      }

      // Tell the client we've QUEUED the job (instant response)
      socket.emit('analysis_queued', {
        pollId,
        message: 'Analysis job queued. Results will arrive shortly...',
      });

      // Fire and forget — the worker handles it asynchronously
      await addAnalysisJob(poll, socket.id);
      console.log(`📬 Analysis job queued for poll: ${pollId}`);
    });

    // ── DISCONNECT ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Export io so the worker can use it to push results back to the client
  (global as any).__socketIO = io;

  return io;
}