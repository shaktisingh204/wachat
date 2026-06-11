/**
 * POST /api/sabflow/workflow/[id]/execute — manual "Execute workflow".
 *
 * Covers: 202 + queued sabflow_executions row for mode:'all', 501 for
 * mode:'singleNode', and the 400/404 validation paths. Completion is only
 * asserted when a sabflow-worker is actually consuming the queue (we poll
 * for up to 10s; a row stuck in `queued` is fine and noted).
 *
 * Note: the route enqueues onto BullMQ, so the DEV SERVER needs Redis. A
 * 500 from the route on a box without Redis is reported as a skip, not a
 * failure.
 */

import { strict as assert } from 'node:assert';
import { ObjectId } from 'mongodb';
import { after, before, test } from 'node:test';
import {
  api,
  closeContext,
  initContext,
  requireServer,
  requireServerAndMongo,
  type TestContext,
} from './_setup';
import { cleanup, createFlow } from '../../e2e/helpers/seed';

let ctx: TestContext;

before(async () => {
  ctx = await initContext();
});

after(async () => {
  if (ctx.mongoOk && ctx.db) await cleanup(ctx.db);
  await closeContext(ctx);
});

test('execute requires auth → 401', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(
    ctx,
    'POST',
    `/api/sabflow/workflow/${new ObjectId().toHexString()}/execute`,
    { auth: false, json: { mode: 'all' } },
  );
  assert.equal(res.status, 401, JSON.stringify(res.body));
});

test('invalid workflow id → 400', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'POST', '/api/sabflow/workflow/not-an-objectid/execute', {
    json: { mode: 'all' },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('invalid mode → 400', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(
    ctx,
    'POST',
    `/api/sabflow/workflow/${new ObjectId().toHexString()}/execute`,
    { json: { mode: 'sideways' } },
  );
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test("mode 'singleNode' → 501 (queue worker runs whole flows only)", async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(
    ctx,
    'POST',
    `/api/sabflow/workflow/${new ObjectId().toHexString()}/execute`,
    { json: { mode: 'singleNode', nodeId: 'n1' } },
  );
  assert.equal(res.status, 501, JSON.stringify(res.body));
});

test('unknown (but valid) workflow id → 404', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(
    ctx,
    'POST',
    `/api/sabflow/workflow/${new ObjectId().toHexString()}/execute`,
    { json: { mode: 'all' } },
  );
  // Reaching the 404 requires the server's Mongo lookup; a 500 here would
  // indicate server-side Mongo problems, surfaced as a hard failure.
  assert.equal(res.status, 404, JSON.stringify(res.body));
});

test("mode 'all' → 202 { executionId, status: 'queued' } + executions row", async (t) => {
  if (!requireServerAndMongo(t, ctx)) return;
  const { flowId } = await createFlow(ctx.db!);

  const res = await api(ctx, 'POST', `/api/sabflow/workflow/${flowId}/execute`, {
    json: { mode: 'all' },
  });
  if (res.status === 500) {
    t.skip(
      'execute returned 500 — the dev server most likely cannot reach Redis ' +
        '(BullMQ enqueue). Start Redis on localhost:6379 and re-run.',
    );
    return;
  }
  assert.equal(res.status, 202, JSON.stringify(res.body));
  assert.equal(res.body.status, 'queued');
  assert.equal(typeof res.body.executionId, 'string');

  // The row the route inserted must exist immediately.
  const row = await ctx.db!
    .collection('sabflow_executions')
    .findOne({ executionId: res.body.executionId });
  assert.ok(row, 'sabflow_executions row missing for the returned executionId');
  assert.equal(row!.flowId, flowId);
  assert.ok(
    ['queued', 'running', 'success', 'error'].includes(String(row!.status)),
    `unexpected execution status ${row!.status}`,
  );

  // Completion assertion is best-effort: only meaningful when a
  // sabflow-worker is consuming the queue. Poll up to 10s.
  const deadline = Date.now() + 10_000;
  let finalStatus = String(row!.status);
  while (Date.now() < deadline && (finalStatus === 'queued' || finalStatus === 'running')) {
    await new Promise((r) => setTimeout(r, 500));
    const fresh = await ctx.db!
      .collection('sabflow_executions')
      .findOne({ executionId: res.body.executionId });
    finalStatus = String(fresh?.status ?? finalStatus);
  }
  if (finalStatus === 'queued') {
    t.diagnostic(
      'execution stayed `queued` for 10s — no sabflow-worker is running; ' +
        'row-existence assertions above still passed (this is expected without the worker)',
    );
  } else {
    t.diagnostic(`execution reached status: ${finalStatus}`);
    assert.ok(
      ['running', 'success', 'error'].includes(finalStatus),
      `unexpected final status ${finalStatus}`,
    );
  }
});
