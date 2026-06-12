#!/usr/bin/env node
/**
 * SabSMS events worker — PM2 entry (`sabsms-events`).
 *
 * Consumes the Rust engine's `sabsms:events` Redis Stream through the
 * consumer-group reader in `src/lib/sabsms/events/consumer.ts`.
 *
 * Run under tsx so the `.ts` import resolves — exactly like the SabFlow
 * workers (see `ecosystem.config.js`):
 *
 *   ./node_modules/.bin/tsx scripts/sabsms-events-worker.mjs
 *
 * The ecosystem entry also sets `NODE_PATH=./src/workers/_stubs` so any
 * transitively imported `server-only` resolves to the benign stub
 * instead of the real poison-pill package (the consumer itself avoids
 * server-only imports, but keep the belt with the suspenders).
 *
 * Required env: MONGODB_URI (+ MONGODB_DB), and either REDIS_URL or
 * REDIS_HOST/REDIS_PORT/REDIS_PASSWORD.
 */

import 'dotenv/config';

// NOTE: default-import + destructure, not a named import — tsx compiles
// the repo's `.ts` modules to CommonJS (no `"type": "module"` in
// package.json), and an ESM `.mjs` entry can't statically lex named
// exports out of that interop shape.
import consumerModule from '../src/lib/sabsms/events/consumer.ts';

const { runSabsmsEventsConsumer } = consumerModule;

const consumer = await runSabsmsEventsConsumer();

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[sabsms-events] ${signal} received; draining...`);
  // Finish the in-flight batch, close Redis + Mongo, then exit. PM2's
  // kill_timeout (10 s) is the hard backstop if Redis hangs.
  try {
    await consumer.stop();
    process.exit(0);
  } catch (err) {
    console.error('[sabsms-events] shutdown error', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// If the read loop dies on its own (it shouldn't — errors are retried
// in-loop), let PM2 restart us.
consumer.done.then(
  () => {
    if (!shuttingDown) {
      console.error('[sabsms-events] consumer loop exited unexpectedly');
      process.exit(1);
    }
  },
  (err) => {
    console.error('[sabsms-events] consumer crashed', err);
    process.exit(1);
  },
);
