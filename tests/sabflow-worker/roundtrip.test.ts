/**
 * SabFlow worker round-trip — enqueue → BullMQ → sabflow-worker → Mongo.
 *
 * Spawns the real worker (`node_modules/.bin/tsx src/workers/sabflow-worker.ts`,
 * exactly how PM2 runs it — see ecosystem.config.js) with
 * `RUST_API_URL=http://127.0.0.1:1` so the Rust engine is guaranteed
 * unreachable and the worker's TS-engine fallback is exercised
 * deterministically (`engine: 'ts'` on the finished row).
 *
 * Two cases:
 *   1. Minimal flow (Start group: text bubble + set_variable marker, same
 *      snapshot shape as e2e/helpers/seed.ts createFlow) → status 'success',
 *      engine 'ts', and the marker variable persisted in updatedVariables —
 *      the positive control proving downstream blocks run and their
 *      variables land in Mongo.
 *   2. Flow containing a `forge_app_preset` block with a bogus presetId,
 *      followed by the same set_variable marker. The worker routes forge
 *      flows straight to the TS engine (the Rust engine would silently skip
 *      forge_* nodes and falsely succeed). ENGINE SEMANTICS, verified in
 *      src/lib/sabflow/engine/executeBlock.ts (buildErrorSignal, strategy
 *      'stop') + executeFlow.ts (errorSignal 'halt'): a failing forge block
 *      HALTS the run gracefully — executeFlow returns normally, so the
 *      worker records status 'success', NOT 'error'. The forge-routing
 *      proof is therefore the halt itself: the marker block placed AFTER
 *      the forge block must NOT have run (marker absent), while case 1
 *      proves the identical marker block runs when nothing halts. If forge
 *      blocks were silently skipped, the marker would be present.
 *
 * The execution row is inserted first with the exact shape retryExecution
 * writes (src/app/dashboard/sabflow/actions.ts), then enqueued via the real
 * producer `enqueueWorkerExecution` (src/lib/sabflow/queue/enqueue-worker.ts).
 *
 * Self-skips (never fails) when Mongo or Redis is unreachable from this
 * process — including the macOS local-network EADDRNOTAVAIL flake — or when
 * the spawned worker never reports "listening".
 *
 * NOTE: enqueue-worker keeps a module-level BullMQ Queue open with no close
 * API — run this file with `--test-force-exit` (the npm script does).
 */

import { strict as assert } from 'node:assert';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { ObjectId, type Db, type MongoClient } from 'mongodb';
import { Queue } from 'bullmq';

import { enqueueWorkerExecution } from '@/lib/sabflow/queue/enqueue-worker';
import { SABFLOW_QUEUE } from '@/lib/sabflow/worker/queues';
import {
  connectMongo,
  ensureTestUser,
  loadEnv,
  repoRoot,
  TEST_USER_ID,
} from '../../e2e/helpers/session';
import { cleanup, E2E_PREFIX } from '../../e2e/helpers/seed';

/* ── State ──────────────────────────────────────────────────────────── */

let client: MongoClient | null = null;
let db: Db | null = null;
let mongoError = '';
let redisOk = false;
let redisError = '';
let worker: ChildProcess | null = null;
let workerReady = false;
let workerLog = '';

/** BullMQ job ids enqueued by this run — removed in teardown so a real
 * PM2 worker started later never replays them. */
const enqueuedJobIds: string[] = [];

/* ── Redis target ───────────────────────────────────────────────────── */

// This repo's .env defines REDIS_HOST= / REDIS_PORT= as EMPTY strings, which
// defeats the `?? 'localhost'` fallbacks in enqueue-worker.ts and the worker
// itself. Resolve with `||` (empty → default) and normalise process.env in
// before() so the in-process producer and the spawned worker (env
// passthrough) both connect to the same resolved target.
const redisHost = () => process.env.REDIS_HOST || 'localhost';
const redisPort = () => Number(process.env.REDIS_PORT || 6379);

/* ── Probes (same pattern as tests/sabflow-api/cron-tick.test.ts) ───── */

function probeRedis(host: string, port: number, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port });
    const fail = (err: Error) => {
      sock.destroy();
      reject(err);
    };
    sock.setTimeout(timeoutMs, () => fail(new Error(`timeout connecting to ${host}:${port}`)));
    sock.once('error', fail);
    sock.once('connect', () => {
      sock.end();
      resolve();
    });
  });
}

/**
 * The TS-engine import chain (executeFlow → executeBlock → forge/index.ts)
 * starts with `import 'server-only'`. Next's compiler strips that import for
 * the dev server, but the spawned worker runs under plain tsx where the
 * package is not even installed in this repo ("Cannot find module
 * 'server-only'"). Provide a benign stub via NODE_PATH (consulted only when
 * the normal node_modules walk fails) so the REAL engine code still executes.
 */
function makeServerOnlyStub(): string {
  const stubRoot = path.join(
    os.tmpdir(),
    `sabflow-roundtrip-stub-${process.pid}`,
    'node_modules',
  );
  const pkgDir = path.join(stubRoot, 'server-only');
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    path.join(pkgDir, 'package.json'),
    JSON.stringify({ name: 'server-only', version: '0.0.0-e2e-stub', main: 'index.js' }),
  );
  writeFileSync(
    path.join(pkgDir, 'index.js'),
    '// e2e stub: Next strips `import "server-only"` at build time; plain node cannot.\n',
  );
  return stubRoot;
}

/** Spawn the worker and wait for its "listening on queue" log line. */
function startWorker(): Promise<void> {
  return new Promise((resolve, reject) => {
    const root = repoRoot();
    const tsxBin = path.join(root, 'node_modules', '.bin', 'tsx');
    const stubNodeModules = makeServerOnlyStub();
    worker = spawn(tsxBin, ['src/workers/sabflow-worker.ts'], {
      cwd: root,
      env: {
        ...process.env,
        // Force the Rust path to fail fast (ECONNREFUSED) → TS engine.
        RUST_API_URL: 'http://127.0.0.1:1',
        SABFLOW_WORKER_CONCURRENCY: '2',
        NODE_PATH: [stubNodeModules, process.env.NODE_PATH]
          .filter(Boolean)
          .join(path.delimiter),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      reject(new Error(`worker did not report listening within 30s; log so far:\n${workerLog}`));
    }, 30_000);

    const onChunk = (chunk: Buffer) => {
      workerLog += chunk.toString();
      if (!workerReady && workerLog.includes('listening on queue')) {
        workerReady = true;
        clearTimeout(timer);
        resolve();
      }
    };
    worker.stdout?.on('data', onChunk);
    worker.stderr?.on('data', onChunk);
    worker.once('exit', (code) => {
      if (!workerReady) {
        clearTimeout(timer);
        reject(new Error(`worker exited early (code ${code}); log:\n${workerLog}`));
      }
    });
  });
}

/* ── Snapshot + row builders ────────────────────────────────────────── */

/** Mirrors createSabFlow / e2e/helpers/seed.ts createFlow. */
function buildFlowSnapshot(
  flowId: string,
  blocks: Array<{ type: string; options: Record<string, unknown> }>,
) {
  const groupId = new ObjectId().toHexString();
  return {
    _id: flowId,
    userId: TEST_USER_ID,
    name: `${E2E_PREFIX}worker-roundtrip-${flowId.slice(-6)}`,
    groups: [
      {
        id: groupId,
        title: 'Start',
        graphCoordinates: { x: 200, y: 200 },
        blocks: blocks.map((b, i) => ({
          id: `${groupId}-b${i}`,
          type: b.type,
          groupId,
          options: b.options,
        })),
      },
    ],
    edges: [] as unknown[],
    events: [] as unknown[],
    variables: [] as unknown[],
    theme: {},
    settings: {},
    status: 'PUBLISHED',
  };
}

/** Insert the executions row exactly like retryExecution
 * (src/app/dashboard/sabflow/actions.ts) before enqueueing. */
async function insertExecutionRow(database: Db, flowId: string): Promise<string> {
  const oid = new ObjectId();
  const executionId = oid.toHexString();
  const now = new Date();
  await database.collection('sabflow_executions').insertOne({
    _id: oid,
    executionId,
    flowId,
    projectId: TEST_USER_ID,
    sessionId: `e2e-roundtrip:${executionId}`,
    triggerMode: 'manual',
    status: 'queued',
    startedAt: now,
    finishedAt: null,
    error: null,
    nodeCount: 0,
    createdAt: now,
    updatedAt: now,
    __e2e: true,
  });
  return executionId;
}

interface FinishedRow {
  status: string;
  engine?: string;
  error?: string | null;
  finishedAt?: Date | null;
  updatedVariables?: Record<string, unknown>;
}

/** Variable set by the trailing set_variable block in both test flows. */
const MARKER_NAME = 'E2E_ROUNDTRIP_MARKER';
const MARKER_VALUE = 'reached-the-end';

const markerBlock = {
  type: 'set_variable',
  options: { variableName: MARKER_NAME, expressionToEvaluate: MARKER_VALUE },
};

async function waitForFinished(
  database: Db,
  executionId: string,
  timeoutMs = 60_000,
): Promise<FinishedRow | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const row = await database
      .collection('sabflow_executions')
      .findOne<FinishedRow>({ executionId });
    if (row && (row.status === 'success' || row.status === 'error')) return row;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return null;
}

/* ── Lifecycle ──────────────────────────────────────────────────────── */

before(async () => {
  loadEnv();
  // Normalise empty-string Redis env vars (see redisHost/redisPort above).
  process.env.REDIS_HOST = redisHost();
  process.env.REDIS_PORT = String(redisPort());
  if (!process.env.REDIS_PASSWORD) delete process.env.REDIS_PASSWORD;
  try {
    const conn = await connectMongo(3000);
    client = conn.client;
    db = conn.db;
    await ensureTestUser(db);
  } catch (err) {
    mongoError = err instanceof Error ? err.message : String(err);
  }
  try {
    await probeRedis(redisHost(), redisPort());
    redisOk = true;
  } catch (err) {
    redisError =
      err instanceof Error
        ? err.message || (err as NodeJS.ErrnoException).code || String(err)
        : String(err);
  }

  if (db && redisOk) {
    try {
      await startWorker();
    } catch (err) {
      workerReady = false;
      workerLog += `\n[startWorker] ${err instanceof Error ? err.message : String(err)}`;
    }
  }
});

after(async () => {
  // Kill the spawned worker first so nothing races the cleanup below.
  if (worker && worker.exitCode === null) {
    const exited = new Promise((r) => worker!.once('exit', r));
    worker.kill('SIGTERM');
    await Promise.race([exited, new Promise((r) => setTimeout(r, 5000))]);
    if (worker.exitCode === null) worker.kill('SIGKILL');
  }

  // Remove our jobs (incl. pending retries of the forge-error case) so a
  // real worker started later never picks them up.
  if (redisOk && enqueuedJobIds.length > 0) {
    const q = new Queue(SABFLOW_QUEUE, {
      connection: {
        host: redisHost(),
        port: redisPort(),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
      },
    });
    try {
      for (const id of enqueuedJobIds) {
        await q.remove(id).catch(() => {});
      }
    } finally {
      await q.close();
    }
  }

  if (db) await cleanup(db); // sweeps sabflow_executions for TEST_USER_ID
  if (client) await client.close();
});

/* ── Skip guard ─────────────────────────────────────────────────────── */

interface Skippable {
  skip: (message?: string) => void;
}

function requireDeps(t: Skippable): boolean {
  if (!db) {
    t.skip(
      `Mongo not reachable from this process (${mongoError}) — macOS local-network flake, see tests/README.md`,
    );
    return false;
  }
  if (!redisOk) {
    t.skip(
      `Redis not reachable at ${redisHost()}:${redisPort()} (${redisError}) — start Redis to run the worker round-trip`,
    );
    return false;
  }
  if (!workerReady) {
    t.skip(`spawned sabflow-worker never reported listening; log:\n${workerLog}`);
    return false;
  }
  return true;
}

/* ── Tests ──────────────────────────────────────────────────────────── */

test('text flow: enqueue → worker → success via TS engine (Rust forced down)', async (t) => {
  if (!requireDeps(t)) return;

  const flowId = new ObjectId().toHexString();
  const snapshot = buildFlowSnapshot(flowId, [
    { type: 'text', options: { content: 'Hi from the worker round-trip test.' } },
    markerBlock,
  ]);
  const executionId = await insertExecutionRow(db!, flowId);

  const jobId = await enqueueWorkerExecution({
    executionId,
    flowId,
    projectId: TEST_USER_ID,
    flowSnapshot: snapshot,
    triggerMode: 'manual',
    variables: {},
  });
  enqueuedJobIds.push(jobId);

  const row = await waitForFinished(db!, executionId);
  assert.ok(row, `execution ${executionId} never finished; worker log:\n${workerLog}`);
  assert.equal(
    row.status,
    'success',
    `expected success, got ${row.status} (error: ${row.error ?? 'none'})`,
  );
  // RUST_API_URL points at a closed port — the run MUST have fallen back.
  assert.equal(row.engine, 'ts', 'engine must be the TS fallback (Rust was forced down)');
  assert.ok(row.finishedAt, 'finishedAt must be set');
  // Positive control for the forge case below: the trailing set_variable
  // block ran and its variable was persisted.
  assert.equal(
    row.updatedVariables?.[MARKER_NAME],
    MARKER_VALUE,
    'the trailing set_variable marker must be persisted in updatedVariables',
  );
});

test('forge flow: bogus forge_app_preset executes on the TS engine and halts the run', async (t) => {
  if (!requireDeps(t)) return;

  const bogusPresetId = 'e2e-bogus-preset-does-not-exist';
  const flowId = new ObjectId().toHexString();
  // Forge block FIRST, marker block AFTER it. The bogus preset makes the
  // forge dispatcher throw (`App preset: '<id>' not found`,
  // src/lib/sabflow/forge/blocks/generic/app_preset.ts) which the engine
  // turns into a graceful 'halt' (onError defaults to 'stop'); the run
  // therefore finishes with status 'success' but execution STOPS at the
  // forge block — the marker must never be set. A Rust-style silent skip
  // would have continued into the marker block.
  const snapshot = buildFlowSnapshot(flowId, [
    {
      type: 'forge_app_preset',
      options: { presetId: bogusPresetId, actionId: 'e2e-action', inputs: {} },
    },
    markerBlock,
  ]);
  const executionId = await insertExecutionRow(db!, flowId);

  const jobId = await enqueueWorkerExecution({
    executionId,
    flowId,
    projectId: TEST_USER_ID,
    flowSnapshot: snapshot,
    triggerMode: 'manual',
    variables: {},
  });
  enqueuedJobIds.push(jobId);

  const row = await waitForFinished(db!, executionId);
  assert.ok(row, `execution ${executionId} never finished; worker log:\n${workerLog}`);
  // Forge flows are routed to the TS engine unconditionally by the worker.
  assert.equal(row.engine, 'ts', 'forge flows must run on the TS engine');
  // Engine semantics: forge failure → halt → executeFlow returns normally →
  // the worker marks the run success (see header comment).
  assert.equal(
    row.status,
    'success',
    `expected the halt semantics (status success); got ${row.status} (error: ${row.error ?? 'none'})`,
  );
  assert.ok(row.finishedAt, 'finishedAt must be set');
  // THE forge-routing proof: the marker block after the failing forge block
  // must not have executed.
  assert.equal(
    row.updatedVariables?.[MARKER_NAME],
    undefined,
    'the marker after the failing forge block must NOT run — its presence would mean the forge block was silently skipped',
  );
});
