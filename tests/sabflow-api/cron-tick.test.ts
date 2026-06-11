/**
 * runScheduledTick — double-tick idempotency, tested DIRECTLY against the
 * lib (src/lib/sabflow/triggers/cron-tick.ts takes a `Db`; it deliberately
 * avoids '@/lib/mongodb' so it loads cleanly under tsx).
 *
 * Needs Mongo AND Redis reachable from THIS process (the tick's
 * enqueueWorkerExecution pushes onto BullMQ at REDIS_HOST:REDIS_PORT,
 * default localhost:6379, no password locally). Both are probed up front
 * and the suite skips with a clear message when unreachable.
 *
 * The BullMQ producer keeps its Redis connection open (module-level
 * singleton in enqueue-worker.ts, no close API exported) — the npm script
 * runs with `--test-force-exit` so the process doesn't hang on it.
 */

import { strict as assert } from 'node:assert';
import net from 'node:net';
import { after, before, test } from 'node:test';
import type { Db, MongoClient } from 'mongodb';
import { runScheduledTick, cronExpressionMatches } from '@/lib/sabflow/triggers/cron-tick';
import { connectMongo, loadEnv } from '../../e2e/helpers/session';
import { cleanup, createScheduledFlow } from '../../e2e/helpers/seed';

let client: MongoClient | null = null;
let db: Db | null = null;
let mongoError = '';
let redisOk = false;
let redisError = '';

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

before(async () => {
  loadEnv();
  try {
    const conn = await connectMongo(3000);
    client = conn.client;
    db = conn.db;
  } catch (err) {
    mongoError = err instanceof Error ? err.message : String(err);
  }
  try {
    await probeRedis(
      process.env.REDIS_HOST ?? 'localhost',
      Number(process.env.REDIS_PORT ?? 6379),
    );
    redisOk = true;
  } catch (err) {
    // ECONNREFUSED on dual-stack localhost surfaces as an AggregateError
    // with an empty .message — fall back to code/String for a useful skip.
    redisError =
      err instanceof Error
        ? err.message || (err as NodeJS.ErrnoException).code || String(err)
        : String(err);
  }
});

after(async () => {
  if (db) await cleanup(db);
  if (client) await client.close();
});

interface Skippable {
  skip: (message?: string) => void;
}

function requireDeps(t: Skippable): boolean {
  if (!db) {
    t.skip(
      `Mongo not reachable from this process (${mongoError}) — on macOS this is usually ` +
        'the local-network permission flake (EADDRNOTAVAIL), see tests/README.md',
    );
    return false;
  }
  if (!redisOk) {
    t.skip(`Redis not reachable (${redisError}) — the tick enqueues onto BullMQ`);
    return false;
  }
  return true;
}

test('cronExpressionMatches: */5 grammar sanity (pure, no deps)', () => {
  const at = (minute: number) => ({ minute, hour: 12, dom: 15, month: 6, dow: 1 });
  assert.equal(cronExpressionMatches('*/5 * * * *', at(10)), true);
  assert.equal(cronExpressionMatches('*/5 * * * *', at(11)), false);
  assert.equal(cronExpressionMatches('* * * * *', at(59)), true);
  assert.equal(cronExpressionMatches('not a cron', at(0)), false);
});

test('double tick on the same minute: 1 claim, 1 execution row, second tick skips', async (t) => {
  if (!requireDeps(t)) return;

  const { flowId, eventId } = await createScheduledFlow(db!, {
    cronExpression: '* * * * *',
    enabled: true,
  });

  // Pin `now` so both ticks evaluate the exact same minute bucket — no
  // wall-clock boundary races.
  const now = new Date();
  const stamp = (() => {
    const d = new Date(now.getTime());
    d.setUTCSeconds(0, 0);
    return d.toISOString().slice(0, 16);
  })();
  const fireKey = `cron:${flowId}:${eventId}:${stamp}`;

  const tick1 = await runScheduledTick(db!, now);
  // Counters are GLOBAL (other published scheduled flows in the dev DB may
  // match the same minute) — the authoritative per-flow assertion is the
  // fireKey row, not the aggregate numbers.
  assert.ok(tick1.matched >= 1, `expected at least our flow to match, got ${tick1.matched}`);
  assert.ok(tick1.enqueued >= 1, `expected at least our fire enqueued, got ${tick1.enqueued}`);

  const rowsAfterFirst = await db!
    .collection('sabflow_executions')
    .find({ fireKey })
    .toArray();
  assert.equal(rowsAfterFirst.length, 1, 'exactly one execution row per (flow,event,minute)');
  assert.equal(rowsAfterFirst[0].flowId, flowId);
  assert.equal(rowsAfterFirst[0].triggerMode, 'schedule');

  const tick2 = await runScheduledTick(db!, now);
  assert.ok(
    tick2.alreadyClaimed >= 1,
    `second tick must see our fire as already claimed, got ${tick2.alreadyClaimed}`,
  );

  const rowsAfterSecond = await db!
    .collection('sabflow_executions')
    .find({ fireKey })
    .toArray();
  assert.equal(rowsAfterSecond.length, 1, 'second tick must not create another row');
  assert.equal(
    String(rowsAfterSecond[0]._id),
    String(rowsAfterFirst[0]._id),
    'row identity must be stable across ticks',
  );
});

test('disabled schedule events never fire', async (t) => {
  if (!requireDeps(t)) return;

  const { flowId, eventId } = await createScheduledFlow(db!, {
    cronExpression: '* * * * *',
    enabled: false,
  });
  const now = new Date();
  await runScheduledTick(db!, now);

  const rows = await db!
    .collection('sabflow_executions')
    .find({ flowId, 'triggerData.eventId': eventId })
    .toArray();
  assert.equal(rows.length, 0, 'disabled event must not enqueue');
});
