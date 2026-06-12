#!/usr/bin/env node
/**
 * SabSMS V2.10 — `sabsms_stats_daily` rollup backfill.
 *
 * Recomputes the daily rollups from the RAW collections
 * (`sabsms_messages`, `sabsms_link_clicks`, `sabsms_consent_log`) for
 * the last N UTC days, for every workspace that had activity on each
 * day. IDEMPOTENT by construction: it reuses `reconcileDay`, which
 * compares the recomputed truth against the stored rollup docs and only
 * writes when they drift — running it twice in a row is a no-op the
 * second time.
 *
 * Run under tsx so the `.ts` imports resolve (same pattern as
 * `scripts/sabsms-events-worker.mjs`):
 *
 *   NODE_PATH=./src/workers/_stubs ./node_modules/.bin/tsx \
 *     scripts/sabsms-backfill-stats.mjs --days 30 [--workspace <id>] [--dry-run]
 *
 * Flags:
 *   --days N         UTC days to backfill, counting back from today
 *                    inclusive (default 30, max 366).
 *   --workspace ID   Restrict to one workspace.
 *   --dry-run        Report drift without writing.
 *
 * Required env: MONGODB_URI (or MONGO_URL) + optional MONGODB_DB
 * (default `sabnode`).
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

// NOTE: default-import + destructure, not named imports — tsx compiles
// the repo's `.ts` modules to CommonJS (no `"type": "module"`), and an
// ESM `.mjs` entry can't statically lex named exports out of that
// interop shape (see scripts/sabsms-events-worker.mjs).
import reconcileModule from '../src/lib/sabsms/analytics/reconcile.ts';
import rollupsModule from '../src/lib/sabsms/analytics/rollups.ts';

const { reconcileDay, foldRawIntoDay, diffDayStats } = reconcileModule;
const { ensureStatsIndexes, utcDateKey } = rollupsModule;

// ─── CLI args ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { days: 30, workspace: null, dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--days') args.days = Number(argv[++i]);
    else if (a.startsWith('--days=')) args.days = Number(a.slice(7));
    else if (a === '--workspace') args.workspace = String(argv[++i] ?? '');
    else if (a.startsWith('--workspace=')) args.workspace = a.slice(12);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: tsx scripts/sabsms-backfill-stats.mjs --days N [--workspace <id>] [--dry-run]',
      );
      process.exit(0);
    } else {
      console.error(`[backfill-stats] unknown flag: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(args.days) || args.days < 1) args.days = 30;
  args.days = Math.min(Math.floor(args.days), 366);
  return args;
}

// ─── Day helpers ───────────────────────────────────────────────────────────

function dayWindow(date) {
  const from = new Date(`${date}T00:00:00.000Z`);
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

/** Workspaces with any raw activity inside the day window. */
async function activeWorkspaces(db, date) {
  const { from, to } = dayWindow(date);
  const stamp = { $gte: from, $lt: to };
  const ids = new Set();

  const [msgWs, clickWs, consentWs] = await Promise.all([
    db.collection('sabsms_messages').distinct('workspaceId', {
      $or: [
        { queuedAt: stamp },
        { sentAt: stamp },
        { deliveredAt: stamp },
        { failedAt: stamp },
        { createdAt: stamp },
      ],
    }),
    db.collection('sabsms_link_clicks').distinct('workspaceId', { clickedAt: stamp }),
    db.collection('sabsms_consent_log').distinct('workspaceId', { createdAt: stamp }),
  ]);
  for (const ws of [...msgWs, ...clickWs, ...consentWs]) {
    if (typeof ws === 'string' && ws) ids.add(ws);
  }
  return [...ids];
}

/** Read-only drift check (the `--dry-run` path) — mirrors reconcileDay. */
async function dryRunDay(db, workspaceId, date) {
  const { from, to } = dayWindow(date);
  const stamp = { $gte: from, $lt: to };
  const [messages, clicks, optOuts, existing] = await Promise.all([
    db
      .collection('sabsms_messages')
      .find({
        workspaceId,
        $or: [
          { queuedAt: stamp },
          { sentAt: stamp },
          { deliveredAt: stamp },
          { failedAt: stamp },
          { createdAt: stamp },
        ],
      })
      .toArray(),
    db.collection('sabsms_link_clicks').find({ workspaceId, clickedAt: stamp }).toArray(),
    db.collection('sabsms_consent_log').find({ workspaceId, createdAt: stamp }).toArray(),
    db
      .collection('sabsms_stats_daily')
      .find({ workspaceId, date }, { projection: { dimsKey: 1, counters: 1 } })
      .toArray(),
  ]);
  const expected = foldRawIntoDay(date, { messages, clicks, optOuts });
  return { drift: diffDayStats(expected, existing), replaced: 0, removed: 0 };
}

// ─── Main ──────────────────────────────────────────────────────────────────

const args = parseArgs(process.argv);

const uri = process.env.MONGODB_URI || process.env.MONGO_URL || '';
if (!uri) {
  console.error('[backfill-stats] MONGODB_URI is not set');
  process.exit(1);
}

const client = new MongoClient(uri, { maxPoolSize: 4 });
await client.connect();
const db = client.db(process.env.MONGODB_DB || 'sabnode');

if (!args.dryRun) await ensureStatsIndexes(db);

const startedAt = Date.now();
let daysChecked = 0;
let pairsChecked = 0;
let pairsWithDrift = 0;
let docsReplaced = 0;
let docsRemoved = 0;

// Oldest → newest so an interrupted run leaves a clean prefix.
const cursor = new Date();
cursor.setUTCDate(cursor.getUTCDate() - (args.days - 1));

try {
  for (let i = 0; i < args.days; i += 1) {
    const date = utcDateKey(cursor.getTime());
    const workspaces = args.workspace
      ? [args.workspace]
      : await activeWorkspaces(db, date);

    for (const ws of workspaces) {
      const result = args.dryRun
        ? await dryRunDay(db, ws, date)
        : await reconcileDay(db, ws, date);
      pairsChecked += 1;
      if (result.drift.length > 0) {
        pairsWithDrift += 1;
        docsReplaced += result.replaced;
        docsRemoved += result.removed;
        console.log(
          `[backfill-stats] ${date} ws=${ws} drift=${result.drift.length}` +
            (args.dryRun
              ? ' (dry-run, not written)'
              : ` replaced=${result.replaced} removed=${result.removed}`),
        );
      }
    }

    daysChecked += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  console.log(
    `[backfill-stats] done: days=${daysChecked} (workspace,day) pairs=${pairsChecked} ` +
      `drifted=${pairsWithDrift} replaced=${docsReplaced} removed=${docsRemoved} ` +
      `dryRun=${args.dryRun} in ${Math.round((Date.now() - startedAt) / 1000)}s`,
  );
} finally {
  await client.close().catch(() => undefined);
}
