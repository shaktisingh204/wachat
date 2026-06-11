/**
 * POST /api/sabflow/test-forge — server-side single-node forge runner.
 *
 * Network-free coverage: validation paths (401/400), an unknown forge
 * type (ok:false via the engine's errorSignal), and a PURE transformer
 * block — `forge_array_reverse` (src/lib/sabflow/forge/blocks/n8n/mass_e/
 * array_reverse.ts: auth `none`, pure JS, no outbound HTTP) — asserting
 * ok:true with the reversed array in `output`.
 *
 * `forge_app_preset` is exercised only on its validation/error path (a
 * preset id that doesn't exist) — running a real preset would hit a live
 * third-party API, which integration tests must not do.
 */

import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import {
  api,
  BASE_URL,
  closeContext,
  initContext,
  requireServer,
  type TestContext,
} from './_setup';

let ctx: TestContext;

before(async () => {
  ctx = await initContext();
});

after(async () => {
  await closeContext(ctx);
});

test('missing/invalid JSON body → 400', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await fetch(`${BASE_URL}/api/sabflow/test-forge`, {
    method: 'POST',
    headers: { cookie: ctx.cookie, 'content-type': 'application/json' },
    body: 'not-json{',
  });
  assert.equal(res.status, 400);
});

test('non-forge block type → 400', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'POST', '/api/sabflow/test-forge', {
    json: { block: { id: 'b1', type: 'text', options: {} } },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('unknown forge_* type → ok:false with a halt error', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'POST', '/api/sabflow/test-forge', {
    json: { block: { id: 'b1', type: 'forge_e2e_does_not_exist', options: {} } },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, false);
  assert.match(String(res.body.error), /Unknown forge block/i);
});

test('forge_array_reverse (pure transformer) → ok:true with reversed output', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'POST', '/api/sabflow/test-forge', {
    json: {
      block: {
        id: 'b1',
        type: 'forge_array_reverse',
        options: { action: 'reverse', items: '[1,2,3]' },
      },
      variables: {},
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, true, JSON.stringify(res.body));
  assert.deepEqual(res.body.output.result, [3, 2, 1]);
  assert.equal(res.body.output.count, 3);
  assert.equal(typeof res.body.durationMs, 'number');
});

test('forge_array_reverse with invalid JSON field → ok:false parse error', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'POST', '/api/sabflow/test-forge', {
    json: {
      block: {
        id: 'b1',
        type: 'forge_array_reverse',
        options: { action: 'reverse', items: '{not json' },
      },
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, false);
  assert.match(String(res.body.error), /not valid JSON/i);
});

test('forge_app_preset with a nonexistent preset → ok:false (no network)', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'POST', '/api/sabflow/test-forge', {
    json: {
      block: {
        id: 'b1',
        type: 'forge_app_preset',
        options: {
          presetId: 'e2e-no-such-preset',
          actionId: 'e2e-no-such-action',
          inputs: {},
        },
      },
      variables: {},
    },
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, false, JSON.stringify(res.body));
  assert.ok(res.body.error, 'expected an error message for an unknown preset');
});
