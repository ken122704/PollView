import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Shared Redis connection used by both the Queue and the Worker
export const redisConnection = new IORedis(
  process.env.REDIS_URL || 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null, // Required by BullMQ
  }
);

// The queue is just a named channel — jobs go IN here
export const analysisQueue = new Queue('poll-analysis', {
  connection: redisConnection,
});

// Helper to add a job with the data our worker needs
export async function addAnalysisJob(poll: any, socketId: string) {
  await analysisQueue.add(
    'analyze',
    { poll, socketId },
    {
      attempts: 3,         // Retry up to 3 times if it fails
      backoff: {
        type: 'exponential',
        delay: 1000,       // Wait 1s, 2s, 4s between retries
      },
    }
  );
}