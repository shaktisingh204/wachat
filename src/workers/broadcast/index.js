'use strict';

/**
 * PM2 entrypoint for the broadcast worker process.
 *
 * Boots both the control worker and the send worker in the same Node process.
 * Run multiple instances under PM2 (`instances: 'max'`) to scale horizontally
 * — BullMQ + the Redis-backed token bucket coordinate them safely.
 *
 * Environment knobs (all optional):
 *   REDIS_URL                          Redis connection string
 *   MONGODB_URI / MONGODB_DB           Mongo connection (required)
 *   BROADCAST_BATCH_SIZE               contacts per send job          (default 200)
 *   BROADCAST_BATCH_PARALLEL           in-job concurrency             (default 64)
 *   BROADCAST_SEND_CONCURRENCY         BullMQ jobs per worker         (default 64)
 *   BROADCAST_CONTROL_CONCURRENCY      control jobs per worker        (default 50)
 *   BROADCAST_DEFAULT_MPS              fallback messages-per-second   (default 80)
 *   BROADCAST_MAX_RETRIES              per-contact transient retries  (default 3)
 *   BROADCAST_RETRY_DELAY_MS           min delay before requeue       (default 5000)
 *   BROADCAST_HTTP_CONNECTIONS         undici pool size               (default 256)
 *   BROADCAST_HTTP_PIPELINING          undici pipelining depth        (default 4)
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const { startControlWorker } = require('./control.worker');
const { startSendWorker } = require('./send.worker');

const workerId =
  process.env.PM2_INSTANCE_ID !== undefined
    ? `pm2-${process.env.PM2_INSTANCE_ID}`
    : `pid-${process.pid}`;

console.log(`[BCAST] booting broadcast worker ${workerId}`);

const controlWorker = startControlWorker(workerId);
const sendWorker = startSendWorker(workerId);

async function shutdown(signal) {
  console.log(`[BCAST] received ${signal}, draining...`);
  try {
    await Promise.all([
      controlWorker.close(),
      sendWorker.close(),
    ]);
  } catch (e) {
    console.error('[BCAST] shutdown error:', e);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('[BCAST] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[BCAST] uncaughtException:', err);
});
