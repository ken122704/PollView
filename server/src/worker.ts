import { Worker, Job } from 'bullmq';
import { getRedisConnection } from './queue';
import { io as SocketClient } from 'socket.io-client';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_URL = `http://localhost:${process.env.PORT || 3001}`;

console.log('🔧 Analysis worker started — waiting for jobs...');
console.log(`📡 Will push results to server at: ${SERVER_URL}`);

const worker = new Worker(
  'poll-analysis',
  async (job: Job) => {
    const { poll, socketId } = job.data;
    console.log(`⚙️  Processing analysis for poll: ${poll.id}`);

    // Simulate heavy computation
    await new Promise((resolve) => setTimeout(resolve, 3000));

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
    };

    // ✅ FIX: Connect back to the server as a Socket.io CLIENT
    // and ask the server to forward the result to the correct user.
    // This works across processes — no shared memory needed.
    await deliverResult(socketId, summary);

    console.log(`✅ Analysis delivered to socket: ${socketId}`);
    return summary;
  },
  { connection: getRedisConnection() }
);

// Connects to the main server and emits a special internal event
// that tells the server to forward the result to the right client.
function deliverResult(socketId: string, summary: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const workerSocket = SocketClient(SERVER_URL, {
      transports: ['websocket'],
    });

    const timeout = setTimeout(() => {
      workerSocket.disconnect();
      reject(new Error('Timed out delivering result to server'));
    }, 5000);

    workerSocket.on('connect', () => {
      workerSocket.emit('worker_result', { socketId, summary });
      clearTimeout(timeout);
      workerSocket.disconnect();
      resolve();
    });

    workerSocket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`✅ Job ${job?.id} completed`);
});