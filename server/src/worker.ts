// worker.ts
// ---------------------------------------------------------------------------
// This file runs as a COMPLETELY SEPARATE Node.js process.
// Run it with: npm run worker
//
// WHY SEPARATE? If "Analyze Results" took 10 seconds on the main server,
// it would block ALL other users' votes for 10 seconds. By offloading to
// a worker, the main server stays responsive for real-time voting while
// the worker crunches numbers in parallel. This is the core of your
// "task distribution" requirement.
// ---------------------------------------------------------------------------

import { Worker, Job } from 'bullmq';
import { redisConnection } from './queue';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔧 Analysis worker started — waiting for jobs...');

const worker = new Worker(
  'poll-analysis',
  async (job: Job) => {
    const { poll, socketId } = job.data;

    console.log(`⚙️  Processing analysis job for poll: ${poll.id}`);

    // ── SIMULATED HEAVY COMPUTATION ─────────────────────────────────
    // In production this could be: ML inference, PDF generation,
    // database aggregation, sending emails, etc.
    // We simulate it with a 3-second delay.
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Generate a simple text summary
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

    // Push the result back to the specific client who requested it
    // We reach into the global Socket.io instance the main server attached
    const io = (global as any).__socketIO;
    if (io) {
      io.to(socketId).emit('analysis_complete', summary);
      console.log(`✅ Analysis sent back to socket: ${socketId}`);
    } else {
      console.warn('⚠️  Socket.io not available in worker context');
      // In production: save to DB and let client poll for results
    }

    return summary;
  },
  { connection: redisConnection }
);

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});