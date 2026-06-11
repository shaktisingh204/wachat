/**
 * /api/sabflow/env-vars — PUT → GET → DELETE round-trip over HTTP.
 *
 * Collection: sabflow_env_vars (src/lib/sabflow/envVars/db.ts). Secrets
 * come back with `value: null` from GET; plain vars round-trip verbatim.
 */

import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import {
  api,
  closeContext,
  initContext,
  requireServer,
  type TestContext,
} from './_setup';
import { cleanup } from '../../e2e/helpers/seed';

const PLAIN_KEY = 'E2E_SABFLOW_PLAIN';
const SECRET_KEY = 'E2E_SABFLOW_SECRET';

let ctx: TestContext;

before(async () => {
  ctx = await initContext();
});

after(async () => {
  // Belt and braces: the test deletes its own keys over HTTP, but sweep
  // the user's vars directly too when Mongo is reachable.
  if (ctx.mongoOk && ctx.db) await cleanup(ctx.db);
  await closeContext(ctx);
});

test('PUT rejects non-UPPER_SNAKE_CASE keys → 400', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'PUT', '/api/sabflow/env-vars', {
    json: { key: 'bad-key', value: 'x' },
  });
  assert.equal(res.status, 400, JSON.stringify(res.body));
});

test('PUT → GET (secret blanked) → DELETE round-trip', async (t) => {
  if (!requireServer(t, ctx)) return;

  // PUT plain
  const putPlain = await api(ctx, 'PUT', '/api/sabflow/env-vars', {
    json: { key: PLAIN_KEY, value: 'hello-e2e', isSecret: false },
  });
  assert.equal(putPlain.status, 200, JSON.stringify(putPlain.body));
  assert.equal(putPlain.body.var.key, PLAIN_KEY);
  assert.equal(putPlain.body.var.value, 'hello-e2e');
  assert.equal(putPlain.body.var.isSecret, false);

  // PUT secret — value must be blanked even in the upsert response
  const putSecret = await api(ctx, 'PUT', '/api/sabflow/env-vars', {
    json: { key: SECRET_KEY, value: 'sshh', isSecret: true },
  });
  assert.equal(putSecret.status, 200, JSON.stringify(putSecret.body));
  assert.equal(putSecret.body.var.key, SECRET_KEY);
  assert.equal(putSecret.body.var.value, null, 'secret value must be blanked');
  assert.equal(putSecret.body.var.isSecret, true);

  // GET — both present; secret blanked, plain verbatim
  const list = await api(ctx, 'GET', '/api/sabflow/env-vars');
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.ok(Array.isArray(list.body.vars));
  const plain = list.body.vars.find((v: { key: string }) => v.key === PLAIN_KEY);
  const secret = list.body.vars.find((v: { key: string }) => v.key === SECRET_KEY);
  assert.ok(plain, `${PLAIN_KEY} missing from GET`);
  assert.equal(plain.value, 'hello-e2e');
  assert.ok(secret, `${SECRET_KEY} missing from GET`);
  assert.equal(secret.value, null, 'secret value must be blanked in list');

  // DELETE both
  for (const key of [PLAIN_KEY, SECRET_KEY]) {
    const del = await api(ctx, 'DELETE', `/api/sabflow/env-vars?key=${key}`);
    assert.equal(del.status, 200, JSON.stringify(del.body));
    assert.equal(del.body.ok, true);
  }

  // DELETE again → 404
  const delAgain = await api(ctx, 'DELETE', `/api/sabflow/env-vars?key=${PLAIN_KEY}`);
  assert.equal(delAgain.status, 404, JSON.stringify(delAgain.body));

  // Gone from GET
  const listAfter = await api(ctx, 'GET', '/api/sabflow/env-vars');
  assert.equal(listAfter.status, 200);
  const stillThere = listAfter.body.vars.filter((v: { key: string }) =>
    [PLAIN_KEY, SECRET_KEY].includes(v.key),
  );
  assert.equal(stillThere.length, 0, 'deleted vars must not be listed');
});

test('DELETE without ?key → 400', async (t) => {
  if (!requireServer(t, ctx)) return;
  const res = await api(ctx, 'DELETE', '/api/sabflow/env-vars');
  assert.equal(res.status, 400, JSON.stringify(res.body));
});
