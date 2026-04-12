import 'server-only';
import { Queue } from 'bullmq';
import IORedis, { Redis } from 'ioredis';

/**
 * Server-side wrapper around the broadcast control queue.
 *
 * The Next.js process produces jobs here; the worker processes (CommonJS twin
 * at src/workers/broadcast/queue.js) consume them. They share the same Redis
 * keys, so type duplication is harmless and intentional — the worker can run
 * standalone under PM2 without depending on Next.js compilation.
 */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Hot-reload-safe singletons. Without this Next.js dev recreates the
// connection on every request and exhausts Redis client slots.
declare global {
  // eslint-disable-next-line no-var
  var __broadcastRedis: Redis | undefined;
  // eslint-disable-next-line no-var
  var __broadcastControlQueue: Queue | undefined;
}

const connection: Redis =
  globalThis.__broadcastRedis ??
  new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
if (!globalThis.__broadcastRedis) {
  globalThis.__broadcastRedis = connection;
}

export const BROADCAST_CONTROL_QUEUE = 'broadcast-control';

export const broadcastControlQueue: Queue =
  globalThis.__broadcastControlQueue ??
  new Queue(BROADCAST_CONTROL_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
if (!globalThis.__broadcastControlQueue) {
  globalThis.__broadcastControlQueue = broadcastControlQueue;
}

/**
 * Enqueue a control job for a freshly-created broadcast.
 *
 * `jobId` is a deterministic dedupe key — calling this twice for the same
 * broadcast is a no-op (BullMQ ignores duplicates), so the server action is
 * safe to retry.
 *
 * Priority is a millisecond-derived value so older queued broadcasts run
 * before newer ones (BullMQ: lower priority number = higher priority).
 */
export async function enqueueBroadcastControl(broadcastId: string): Promise<void> {
  await broadcastControlQueue.add(
    'process-broadcast',
    { broadcastId },
    {
      jobId: `bcast_${broadcastId}`,
      priority: Math.max(1, Date.now() % 1_000_000_000),
    },
  );
}
