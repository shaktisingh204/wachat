/**
 * Phase 4 — ForgeHelpers tests.
 *
 *   npx tsx --test src/lib/sabflow/forge/__tests__/helpers.test.ts
 */
import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';

import { makeHelpers } from '../helpers';

type CapturedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
};

let captured: CapturedCall[] = [];

function installMockFetch() {
  // Replace global fetch with a recorder. Returns a 200 JSON body.
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    const headers = (init?.headers as Record<string, string>) ?? {};
    captured.push({
      url: input,
      method: init?.method ?? 'GET',
      headers,
      body: init?.body as string | undefined,
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  captured = [];
  installMockFetch();
});

/* ── httpRequest ────────────────────────────────────────────────────────── */

test('httpRequest sends no auth header', async () => {
  const helpers = makeHelpers(undefined);
  const res = await helpers.httpRequest({
    method: 'GET',
    url: 'https://api.example/x',
  });
  assert.equal(res.ok, true);
  assert.equal(captured.length, 1);
  assert.equal(captured[0].headers.Authorization, undefined);
});

test('httpRequest serialises json body + sets Content-Type', async () => {
  const helpers = makeHelpers(undefined);
  await helpers.httpRequest({
    method: 'POST',
    url: 'https://api.example/x',
    json: { name: 'Ada' },
  });
  assert.equal(captured[0].body, '{"name":"Ada"}');
  assert.equal(captured[0].headers['Content-Type'], 'application/json');
});

test('httpRequest appends query params, skipping undefined', async () => {
  const helpers = makeHelpers(undefined);
  await helpers.httpRequest({
    method: 'GET',
    url: 'https://api.example/x',
    query: { limit: 50, cursor: undefined, name: 'ada' },
  });
  // URL is normalised — assert via `URL.searchParams` to avoid order coupling.
  const u = new URL(captured[0].url);
  assert.equal(u.searchParams.get('limit'), '50');
  assert.equal(u.searchParams.get('name'), 'ada');
  assert.equal(u.searchParams.has('cursor'), false);
});

test('httpRequest preserves caller-set headers', async () => {
  const helpers = makeHelpers(undefined);
  await helpers.httpRequest({
    method: 'POST',
    url: 'https://api.example/x',
    headers: { 'X-Custom': 'yes' },
    json: { a: 1 },
  });
  assert.equal(captured[0].headers['X-Custom'], 'yes');
});

/* ── requestWithAuthentication: bearer ──────────────────────────────────── */

test('bearer auth injects Authorization: Bearer <accessToken>', async () => {
  const helpers = makeHelpers({ accessToken: 'tok_abc' });
  await helpers.requestWithAuthentication('bearer', {
    method: 'GET',
    url: 'https://api.example/x',
  });
  assert.equal(captured[0].headers.Authorization, 'Bearer tok_abc');
});

test('bearer auth: tokenField override picks the right credential key', async () => {
  const helpers = makeHelpers({ botToken: 'xoxb-1' });
  await helpers.requestWithAuthentication('bearer', {
    method: 'GET',
    url: 'https://slack.com/api/x',
    tokenField: 'botToken',
  });
  assert.equal(captured[0].headers.Authorization, 'Bearer xoxb-1');
});

test('bearer auth: missing field throws with explicit field name', async () => {
  const helpers = makeHelpers({ otherField: 'foo' });
  await assert.rejects(
    helpers.requestWithAuthentication('bearer', {
      method: 'GET',
      url: 'https://api.example/x',
    }),
    /missing field "accessToken"/,
  );
});

/* ── requestWithAuthentication: basic ───────────────────────────────────── */

test('basic auth builds Authorization: Basic base64(user:pass)', async () => {
  const helpers = makeHelpers({ username: 'ada', password: 'lovelace' });
  await helpers.requestWithAuthentication('basic', {
    method: 'GET',
    url: 'https://api.example/x',
  });
  const expected = `Basic ${Buffer.from('ada:lovelace').toString('base64')}`;
  assert.equal(captured[0].headers.Authorization, expected);
});

test('basic auth: throws when both username + password are missing', async () => {
  const helpers = makeHelpers({});
  await assert.rejects(
    helpers.requestWithAuthentication('basic', {
      method: 'GET',
      url: 'https://api.example/x',
    }),
    /username \+ password/,
  );
});

/* ── requestWithAuthentication: apiKey ──────────────────────────────────── */

test('apiKey auth injects X-Api-Key from default field', async () => {
  const helpers = makeHelpers({ apiKey: 'k_xyz' });
  await helpers.requestWithAuthentication('apiKey', {
    method: 'GET',
    url: 'https://api.example/x',
  });
  assert.equal(captured[0].headers['X-Api-Key'], 'k_xyz');
});

test('apiKey auth: tokenField override', async () => {
  const helpers = makeHelpers({ secretKey: 'sk_42' });
  await helpers.requestWithAuthentication('apiKey', {
    method: 'GET',
    url: 'https://api.example/x',
    tokenField: 'secretKey',
  });
  assert.equal(captured[0].headers['X-Api-Key'], 'sk_42');
});

/* ── safety ─────────────────────────────────────────────────────────────── */

test('requestWithAuthentication: throws when no credential is bound', async () => {
  // Critical default-deny: a forge block that calls
  // requestWithAuthentication MUST have a credential. Silent unauthed
  // sends would surface as cryptic 401s downstream — explicit throw is
  // safer and matches n8n's behaviour.
  const helpers = makeHelpers(undefined);
  await assert.rejects(
    helpers.requestWithAuthentication('bearer', {
      method: 'GET',
      url: 'https://api.example/x',
    }),
    /no credential bound/,
  );
});

test('httpRequest still works without credential (public endpoints)', async () => {
  const helpers = makeHelpers(undefined);
  const res = await helpers.httpRequest({
    method: 'GET',
    url: 'https://api.example/health',
  });
  assert.equal(res.ok, true);
});
