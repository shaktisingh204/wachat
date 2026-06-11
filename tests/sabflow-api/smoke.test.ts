/**
 * SabFlow API smoke tests — auth gating + basic 200s and response shapes.
 *
 *   npm run test:sabflow-api          (all files)
 *   npx tsx --test tests/sabflow-api/smoke.test.ts
 *
 * Prerequisites: dev server on :3002 (and Mongo for the seeded cases) —
 * see tests/README.md.
 */

import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import {
  api,
  closeContext,
  initContext,
  requireServer,
  requireServerAndMongo,
  type TestContext,
} from './_setup';
import { cleanup, createFlow, createWorkspaceInvite } from '../../e2e/helpers/seed';
import { TEST_USER_EMAIL } from '../../e2e/helpers/session';

let ctx: TestContext;

before(async () => {
  ctx = await initContext();
});

after(async () => {
  if (ctx.mongoOk && ctx.db) await cleanup(ctx.db);
  await closeContext(ctx);
});

/* ── Unauthenticated → 401 ──────────────────────────────────────────── */

for (const [method, path] of [
  ['GET', '/api/sabflow/executions'],
  ['GET', '/api/sabflow/logs'],
  ['GET', '/api/sabflow/flows-by-folder?folder=anything'],
  ['GET', '/api/sabflow/workspaces/invites'],
  ['GET', '/api/sabflow/env-vars'],
  ['POST', '/api/sabflow/test-forge'],
] as const) {
  test(`${method} ${path} without a session cookie → 401`, async (t) => {
    if (!requireServer(t, ctx)) return;
    const res = await api(ctx, method, path, {
      auth: false,
      ...(method === 'POST' ? { json: {} } : {}),
    });
    assert.equal(res.status, 401, `expected 401, got ${res.status}: ${JSON.stringify(res.body)}`);
  });
}

/* ── Authenticated happy paths ──────────────────────────────────────── */

test('GET /api/sabflow/executions → 200 { executions: [] }', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'GET', '/api/sabflow/executions');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body.executions), 'executions must be an array');
});

test('GET /api/sabflow/logs → 200 { logs: [] } with valid line shape', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'GET', '/api/sabflow/logs?limit=10');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body.logs), 'logs must be an array');
  for (const line of res.body.logs) {
    assert.equal(typeof line.id, 'string');
    assert.equal(typeof line.timestamp, 'string');
    assert.ok(
      ['info', 'warning', 'error', 'debug', 'critical'].includes(line.severity),
      `unexpected severity ${line.severity}`,
    );
  }
});

test('GET /api/sabflow/flows-by-folder without ?folder → 400', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'GET', '/api/sabflow/flows-by-folder');
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('GET /api/sabflow/flows-by-folder returns the seeded flow', async (t) => {
  if (!requireServerAndMongo(t, ctx)) return;
  // SabFlowDoc.folderId stores the folder NAME (see the route's doc note).
  const folderName = `e2e-folder-${Date.now()}`;
  const { flowId, name } = await createFlow(ctx.db!, { folderId: folderName });

  const res = await api(
    ctx,
    'GET',
    `/api/sabflow/flows-by-folder?folder=${encodeURIComponent(folderName)}`,
  );
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.count, 1);
  assert.deepEqual(res.body.flows, [{ id: flowId, name }]);
});

test('GET /api/sabflow/workspaces/invites → 200 with inbox/outbox arrays', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'GET', '/api/sabflow/workspaces/invites');
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.ok(Array.isArray(res.body.incoming), 'incoming must be an array');
  assert.ok(Array.isArray(res.body.sent), 'sent must be an array');
});

test('workspaces/invites surfaces a seeded incoming + sent invite', async (t) => {
  if (!requireServerAndMongo(t, ctx)) return;
  // Incoming: an invite addressed to the fixture user's email.
  const incoming = await createWorkspaceInvite(ctx.db!, { email: TEST_USER_EMAIL });
  // Sent: an invite from a workspace the fixture user owns.
  const sent = await createWorkspaceInvite(ctx.db!, { email: 'e2e-someone-else@test.local' });

  const res = await api(ctx, 'GET', '/api/sabflow/workspaces/invites');
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const inboxHit = res.body.incoming.find((i: { id: string }) => i.id === incoming.inviteId);
  assert.ok(inboxHit, 'seeded incoming invite missing from inbox');
  assert.equal(inboxHit.workspaceId, incoming.workspaceId);
  assert.equal(typeof inboxHit.token, 'string');

  const outboxHit = res.body.sent.find((i: { id: string }) => i.id === sent.inviteId);
  assert.ok(outboxHit, 'seeded sent invite missing from outbox');
  assert.equal(outboxHit.email, sent.email);
});
