import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import {
  castVote,
  getPoll,
  getPollByShortCode,
  getAllPolls,
  seedDefaultPoll,
  createPoll,
  updatePoll,
  updatePollStatus
} from './pollStore';
import { addAnalysisJob } from './queue';

const defaultPoll = seedDefaultPoll();
console.log(`📊 Default poll created: ${defaultPoll.id} (Code: ${defaultPoll.shortCode})`);

export function initSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on('join_poll', (pollId: string) => {
      socket.join(pollId);
      const poll = getPoll(pollId);
      if (poll) {
        socket.emit('poll_state', poll);
        console.log(`👤 ${socket.id} joined room: ${pollId}`);
      } else {
        socket.emit('error_message', `Poll ${pollId} not found`);
      }
    });

    socket.on('join_by_code', (shortCode: string) => {
      if (!shortCode) return;
      const poll = getPollByShortCode(shortCode.toUpperCase());
      if (poll) {
        socket.join(poll.id); 
        socket.emit('poll_state', poll);
        console.log(`👤 ${socket.id} joined via code: ${shortCode}`);
      } else {
        socket.emit('error_message', `Invalid code: ${shortCode}`);
      }
    });

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
      socket.emit('poll_created', poll);
      socket.broadcast.emit('poll_created', poll);
    });

    socket.on('update_poll_status', (payload: { pollId: string, status: 'waiting' | 'active' | 'closed' }) => {
      const updated = updatePollStatus(payload.pollId, payload.status);
      if (updated) {
        io.to(payload.pollId).emit('poll_update', updated);
        io.emit('poll_updated_meta', updated);
      }
    });

    socket.on('update_poll', (payload: { pollId: string; question: string; options: string[] }) => {
      const { pollId, question, options } = payload;
      if (!question?.trim() || !options || options.length < 2) return;
      const updated = updatePoll(
        pollId,
        question.trim(),
        options.map((o: string) => o.trim()).filter(Boolean)
      );
      if (updated) {
        io.to(pollId).emit('poll_update', updated);
        io.emit('poll_updated_meta', updated);
      }
    });

    socket.on('cast_vote', async (payload: { pollId: string; optionId: string }) => {
      const { pollId, optionId } = payload;
      const updatedPoll = await castVote(pollId, optionId);
      if (updatedPoll) {
        io.to(pollId).emit('poll_update', updatedPoll);
      } else {
        socket.emit('error_message', 'Vote failed: invalid poll or option');
      }
    });

    socket.on('get_polls', () => {
      socket.emit('polls_list', getAllPolls());
    });

    socket.on('analyze_poll', async (pollId: string) => {
      const poll = getPoll(pollId);
      if (!poll) return;
      socket.emit('analysis_queued', { pollId, message: 'Analysis job queued...' });
      const queued = await addAnalysisJob(poll, socket.id);
      if (!queued) {
        runAnalysisInline(poll, socket);
      }
    });

    socket.on('worker_result', ({ socketId, summary }: { socketId: string; summary: any }) => {
      io.to(socketId).emit('analysis_complete', summary);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  (global as any).__socketIO = io;

  function runAnalysisInline(poll: any, socket: any) {
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
        winnerPercentage: poll.totalVotes > 0 ? ((winner.votes / poll.totalVotes) * 100).toFixed(1) : '0',
        breakdown: poll.options.map((opt: any) => ({
          label: opt.label,
          votes: opt.votes,
          percentage: poll.totalVotes > 0 ? ((opt.votes / poll.totalVotes) * 100).toFixed(1) : '0',
        })),
        generatedAt: new Date().toISOString(),
      };
      socket.emit('analysis_complete', summary);
    }, 3000);
  }

  return io;
}