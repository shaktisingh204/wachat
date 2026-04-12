'use strict';

/**
 * BullMQ wiring for the broadcast pipeline (worker side, CommonJS).
 *
 * Two queues:
 *   broadcast-control : 1 job per broadcast. Streams the contact cursor and
 *                       fans out batch jobs. Cheap, low concurrency.
 *   broadcast-send    : 1 job per batch (BROADCAST_BATCH_SIZE contacts).
 *                       High concurrency. Acquires Redis tokens before each
 *                       Meta call so per-broadcast MPS is enforced globally.
 *
 * The Next.js server action imports a TS twin (src/lib/queue/broadcast-queue.ts)
 * that creates queue instances against the same Redis keys.
 */

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// BullMQ requires `maxRetriesPerRequest: null` for blocking commands.
function makeConnection() {
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

// One connection for queue producers/consumers, one for direct Redis ops
// (token bucket). BullMQ likes a dedicated connection.
const bullConnection = makeConnection();
const redis = makeConnection();

const BROADCAST_CONTROL_QUEUE = 'broadcast-control';
const BROADCAST_SEND_QUEUE = 'broadcast-send';

const controlQueue = new Queue(BROADCAST_CONTROL_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

const sendQueue = new Queue(BROADCAST_SEND_QUEUE, {
  connection: bullConnection,
  defaultJobOptions: {
    // Per-job retries handle batch-level transient failures (network blips,
    // Mongo hiccups). Per-contact retries are tracked separately on
    // broadcast_contacts.attempts.
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 3600, count: 5000 },
    removeOnFail: { age: 24 * 3600 },
  },
});

async function enqueueBatch(broadcastId, contactIds, opts = {}) {
  return sendQueue.add(
    'send-batch',
    { broadcastId: String(broadcastId), contactIds: contactIds.map(String) },
    {
      // Older broadcasts get lower priority numbers = served first.
      // BullMQ priority: lower = higher priority.
      priority: opts.priority || 1000,
      delay: opts.delay || 0,
    }
  );
}

async function enqueueControl(broadcastId, opts = {}) {
  return controlQueue.add(
    'process-broadcast',
    { broadcastId: String(broadcastId) },
    {
      jobId: `bcast:${broadcastId}`, // de-dupe: re-queueing the same broadcast is a no-op
      priority: opts.priority || 1000,
    }
  );
}

module.exports = {
  bullConnection,
  redis,
  controlQueue,
  sendQueue,
  enqueueBatch,
  enqueueControl,
  BROADCAST_CONTROL_QUEUE,
  BROADCAST_SEND_QUEUE,
};
