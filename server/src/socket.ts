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

    // ── CREATE POLL ─────────────────────────────────────────────
    socket.on('create_poll', (payload: { question: string; options: string[] }) => {
      const { question, options } = payload;

      if (!question?.trim() || !options || options.length < 2) {
        socket.emit('error_message', 'Invalid poll data');
        return;
      }

      const poll = createPoll(
        question.trim(),
        options.map((o: string) => o.trim()).filter(Boolean)
      );

      // Tell the creator their poll is ready
      socket.emit('poll_created', poll);

      // Tell ALL other connected clients a new poll exists
      socket.broadcast.emit('poll_created', poll);

      console.log(`📊 New poll created: "${poll.question}" (${poll.options.length} options)`);
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

    // Tell the client immediately that we received the request
    socket.emit('analysis_queued', {
        pollId,
        message: 'Analysis job queued. Results will arrive in ~3 seconds...',
    });

    // addAnalysisJob now returns false instead of throwing if Redis is down
    const queued = await addAnalysisJob(poll, socket.id);

    if (!queued) {
        // Redis is down — fall back to running the analysis inline
        // (not ideal for production, but keeps the demo working)
        console.warn('⚠️  Redis unavailable — running analysis inline as fallback');
        runAnalysisInline(poll, socket);
    }
    });

    // ✅ NEW: Worker connects back as a client and fires this event
    // The server then forwards the summary to the correct end-user socket
    socket.on('worker_result', ({ socketId, summary }: { socketId: string; summary: any }) => {
    console.log(`📬 Worker result received, forwarding to client: ${socketId}`);
    // io.to(socketId) sends ONLY to the specific user who requested analysis
    io.to(socketId).emit('analysis_complete', summary);
    });

    // ── DISCONNECT ──────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  // Export io so the worker can use it to push results back to the client
  (global as any).__socketIO = io;

        function runAnalysisInline(poll: any, socket: any) {
        // Simulate the 3s delay even in fallback mode
        setTimeout(() => {
            const winner = poll.options.reduce(
            (best: any, opt: any) => (opt.votes > best.votes ? opt : best),
            poll.options[0]
            );

            const summary = {
            pollId: poll.id,
            question: poll.question,
            totalVotes: poll.totalVotes,
            winner: winner.label,
            winnerVotes: winner.votes,
            winnerPercentage:
                poll.totalVotes > 0
                ? ((winner.votes / poll.totalVotes) * 100).toFixed(1)
                : '0',
            breakdown: poll.options.map((opt: any) => ({
                label: opt.label,
                votes: opt.votes,
                percentage:
                poll.totalVotes > 0
                    ? ((opt.votes / poll.totalVotes) * 100).toFixed(1)
                    : '0',
            })),
            generatedAt: new Date().toISOString(),
            note: 'Processed inline (Redis unavailable)',
            };

            socket.emit('analysis_complete', summary);
        }, 3000);
    }
  return io;
}