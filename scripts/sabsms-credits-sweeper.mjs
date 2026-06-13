#!/usr/bin/env node
/**
 * SabSMS credits sweeper — PM2 entry (`sabsms-credits-sweeper`).
 *
 * The credits ledger takes 15-minute holds when a send reserves credits
 * (`reserveInternal` in `src/lib/sabsms/credits/ledger.ts`). If the engine
 * crashes between reserve and finalise, those holds must be auto-released
 * back to the workspace balance once they expire.
 *
 * `releaseExpiredHolds(limit)` does the refund, but it was only ever
 * invoked opportunistically from `POST /api/sabsms/credits` (capped, and
 * dependent on incoming traffic). On an idle deployment expired holds sat
 * frozen indefinitely. This long-lived worker calls it on a fixed 60s
 * interval so the TTL release is genuinely time-driven.
 *
 * Run under tsx so the `.ts` import resolves — same bootstrap as
 * `scripts/sabsms-events-worker.mjs`:
 *
 *   NODE_PATH=./src/workers/_stubs ./node_modules/.bin/tsx \
 *     scripts/sabsms-credits-sweeper.mjs
 *
 * `ledger.ts` begins with `import 'server-only'` and imports `@/lib/mongodb`;
 * the ecosystem entry sets `NODE_PATH=./src/workers/_stubs` so `server-only`
 * resolves to the benign stub, and tsx honours the repo's tsconfig `@/*`
 * path mapping.
 *
 * Required env: MONGODB_URI (+ MONGODB_DB). Optional:
 *   SABSMS_SWEEP_INTERVAL_MS (default 60000),
 *   SABSMS_SWEEP_BATCH       (default 200).
 */

import 'dotenv/config';

// NOTE: default-import + destructure, not a named import — tsx compiles
// the repo's `.ts` modules to CommonJS (no `"type": "module"` in
// package.json), and an ESM `.mjs` entry can't statically lex named
// exports out of that interop shape.
import ledgerModule from '../src/lib/sabsms/credits/ledger.ts';

const { releaseExpiredHolds } = ledgerModule;

if (typeof releaseExpiredHolds !== 'function') {
  console.error(
    '[sabsms-credits-sweeper] releaseExpiredHolds export missing from ledger.ts',
  );
  process.exit(1);
}

const INTERVAL_MS = Number(process.env.SABSMS_SWEEP_INTERVAL_MS) || 60_000;
const BATCH = Number(process.env.SABSMS_SWEEP_BATCH) || 200;

let running = false;
let shuttingDown = false;

async function sweepOnce() {
  if (running || shuttingDown) return;
  running = true;
  try {
    const released = await releaseExpiredHolds(BATCH);
    if (released > 0) {
      console.log(`[sabsms-credits-sweeper] released ${released} expired hold(s)`);
    }
  } catch (err) {
    console.error('[sabsms-credits-sweeper] sweep failed', err);
  } finally {
    running = false;
  }
}

console.log(
  `[sabsms-credits-sweeper] up — sweeping every ${INTERVAL_MS}ms (batch=${BATCH})`,
);

// Fire one sweep immediately on boot, then on the interval.
void sweepOnce();
const timer = setInterval(() => void sweepOnce(), INTERVAL_MS);

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[sabsms-credits-sweeper] ${signal} received; stopping`);
  clearInterval(timer);
  // Give an in-flight sweep a moment to settle; PM2 kill_timeout is the
  // hard backstop.
  setTimeout(() => process.exit(0), 200);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
