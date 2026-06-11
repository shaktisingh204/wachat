/**
 * SabFlow scheduler — PM2 worker that fires `schedule` trigger events.
 *
 * Every minute (aligned to the wall-clock minute boundary) it runs
 * `runScheduledTick` from `@/lib/sabflow/triggers/cron-tick`, which scans
 * published flows for enabled schedule events, matches their cron
 * expressions, and enqueues executions onto the BullMQ queue consumed by
 * the sibling `sabflow-worker` process.
 *
 * Every six hours it also drives doc compaction by calling
 * `GET /api/cron/sabflow-gc` on the local Next.js server (the compaction
 * code is `server-only` and cannot run under tsx) — set `CRON_SECRET` and,
 * if the web app isn't on :3002, `SABNODE_INTERNAL_URL`.
 *
 * Safe to run alongside the HTTP tick (`GET /api/cron/sabflow-scheduled`)
 * — fires are claimed atomically per (flow, event, minute).
 *
 * PM2 app name: `sabflow-scheduler` (see ecosystem.config.js).
 * Env: MONGODB_URI, MONGODB_DB, REDIS_HOST/PORT/PASSWORD,
 *      CRON_SECRET, SABNODE_INTERNAL_URL.
 *
 * Like `sabflow-worker.ts`, this file owns its Mongo client instead of
 * importing `@/lib/mongodb` — that module is `server-only` and crashes
 * under the tsx runtime.
 */

import 'dotenv/config';
import { MongoClient, type Db } from 'mongodb';

import { runScheduledTick } from '@/lib/sabflow/triggers/cron-tick';

// ── Mongo (own client; @/lib/mongodb is server-only) ────────────────────────

let _client: MongoClient | null = null;

async function getDb(): Promise<Db> {
  if (!_client) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('[sabflow-scheduler] MONGODB_URI is not set');
    _client = new MongoClient(uri);
    await _client.connect();
  }
  return _client.db(process.env.MONGODB_DB || undefined);
}

// ── Minute loop ──────────────────────────────────────────────────────────────

let stopping = false;
let ticking = false;

async function tick(): Promise<void> {
  if (ticking) {
    // A slow tick overran the minute — skip rather than overlap; the next
    // minute's fires are claimed independently so nothing is lost.
    console.warn('[sabflow-scheduler] previous tick still running, skipping');
    return;
  }
  ticking = true;
  try {
    const db = await getDb();
    const result = await runScheduledTick(db);
    if (result.matched > 0 || result.errors > 0) {
      console.log(
        `[sabflow-scheduler] ${result.minute} scanned=${result.scanned} matched=${result.matched} ` +
          `enqueued=${result.enqueued} claimed-elsewhere=${result.alreadyClaimed} ` +
          `deferred=${result.deferred} errors=${result.errors}`,
      );
    }
  } catch (err) {
    console.error('[sabflow-scheduler] tick failed:', err);
  } finally {
    ticking = false;
  }
}

function msUntilNextMinute(): number {
  const now = Date.now();
  return 60_000 - (now % 60_000);
}

// ── 6-hourly GC ping (compaction runs inside the Next.js server) ────────────

const GC_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function pingGc(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn('[sabflow-scheduler] CRON_SECRET not set — skipping gc ping');
    return;
  }
  const base = process.env.SABNODE_INTERNAL_URL ?? 'http://127.0.0.1:3002';
  try {
    const res = await fetch(`${base}/api/cron/sabflow-gc`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await res.text();
    console.log(`[sabflow-scheduler] gc tick → ${res.status} ${body.slice(0, 200)}`);
  } catch (err) {
    console.error('[sabflow-scheduler] gc ping failed:', err);
  }
}

function scheduleNext(): void {
  if (stopping) return;
  // Re-align every iteration so drift never accumulates; +50ms keeps the
  // tick safely inside the new minute.
  setTimeout(async () => {
    await tick();
    scheduleNext();
  }, msUntilNextMinute() + 50);
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[sabflow-scheduler] ${signal} received, shutting down`);
  try {
    await _client?.close();
  } catch {
    // best-effort
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

console.log(
  `[sabflow-scheduler] started — first tick in ${Math.round(msUntilNextMinute() / 1000)}s`,
);
scheduleNext();

// First GC ping shortly after boot (lets the web app come up), then 6-hourly.
setTimeout(() => {
  void pingGc();
  setInterval(() => void pingGc(), GC_INTERVAL_MS);
}, 60_000);
