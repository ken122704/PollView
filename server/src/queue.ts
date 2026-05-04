import { Queue } from 'bullmq';
import IORedis from 'ioredis';

let redisConnection: IORedis | null = null;
let analysisQueue: Queue | null = null;

function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(
      process.env.REDIS_URL || 'redis://localhost:6379',
      {
        maxRetriesPerRequest: null,
        // Don't crash the process on connection failure — just log it
        lazyConnect: true,
      }
    );

    redisConnection.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
      console.error('   Make sure Redis is running: redis-server');
    });
  }
  return redisConnection;
}

function getQueue(): Queue {
  if (!analysisQueue) {
    analysisQueue = new Queue('poll-analysis', {
      connection: getRedisConnection(),
    });
  }
  return analysisQueue;
}

export { getRedisConnection };

export async function addAnalysisJob(poll: any, socketId: string): Promise<boolean> {
  try {
    const queue = getQueue();
    await queue.add(
      'analyze',
      { poll, socketId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }
    );
    return true;
  } catch (err: any) {
    console.error('❌ Failed to add job to queue:', err.message);
    console.error('   Is Redis running? Try: redis-server');
    return false;
  }
}