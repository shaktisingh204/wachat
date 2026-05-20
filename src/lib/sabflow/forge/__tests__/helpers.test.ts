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

/* ── requestWithAuthentication: custom-header ───────────────────────────── */

test('custom-header auth injects the named header from credential field', async () => {
  const helpers = makeHelpers({ accessToken: 'shpat_123' });
  await helpers.requestWithAuthentication('custom-header', {
    method: 'GET',
    url: 'https://shop.myshopify.com/admin/api/2024-10/orders.json',
    headerName: 'X-Shopify-Access-Token',
    tokenField: 'accessToken',
  });
  assert.equal(captured[0].headers['X-Shopify-Access-Token'], 'shpat_123');
  // No Authorization header should be injected for custom-header.
  assert.equal(captured[0].headers.Authorization, undefined);
});

test('custom-header auth: Notion-Version style header (different field name)', async () => {
  const helpers = makeHelpers({ apiKey: 'secret_ntn' });
  await helpers.requestWithAuthentication('custom-header', {
    method: 'GET',
    url: 'https://api.example/x',
    headerName: 'Notion-Version',
    tokenField: 'apiKey',
  });
  assert.equal(captured[0].headers['Notion-Version'], 'secret_ntn');
});

test('custom-header auth: missing headerName throws', async () => {
  const helpers = makeHelpers({ accessToken: 'x' });
  await assert.rejects(
    helpers.requestWithAuthentication('custom-header', {
      method: 'GET',
      url: 'https://api.example/x',
      tokenField: 'accessToken',
    }),
    /req\.headerName is required/,
  );
});

test('custom-header auth: missing tokenField throws', async () => {
  const helpers = makeHelpers({ accessToken: 'x' });
  await assert.rejects(
    helpers.requestWithAuthentication('custom-header', {
      method: 'GET',
      url: 'https://api.example/x',
      headerName: 'X-Foo',
    }),
    /req\.tokenField is required/,
  );
});

test('custom-header auth: missing credential field throws', async () => {
  const helpers = makeHelpers({ otherField: 'x' });
  await assert.rejects(
    helpers.requestWithAuthentication('custom-header', {
      method: 'GET',
      url: 'https://api.example/x',
      headerName: 'X-Foo',
      tokenField: 'accessToken',
    }),
    /missing field "accessToken"/,
  );
});

/* ── requestWithAuthentication: basic-custom ────────────────────────────── */

test('basic-custom: Stripe-style (user=secretKey, no pass) → empty pass', async () => {
  const helpers = makeHelpers({ secretKey: 'sk_test_42' });
  await helpers.requestWithAuthentication('basic-custom', {
    method: 'GET',
    url: 'https://api.stripe.com/v1/customers',
    userField: 'secretKey',
  });
  const expected = `Basic ${Buffer.from('sk_test_42:').toString('base64')}`;
  assert.equal(captured[0].headers.Authorization, expected);
});

test('basic-custom: Twilio-style (user=accountSid, pass=authToken)', async () => {
  const helpers = makeHelpers({ accountSid: 'AC123', authToken: 'tok_secret' });
  await helpers.requestWithAuthentication('basic-custom', {
    method: 'GET',
    url: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json',
    userField: 'accountSid',
    passField: 'authToken',
  });
  const expected = `Basic ${Buffer.from('AC123:tok_secret').toString('base64')}`;
  assert.equal(captured[0].headers.Authorization, expected);
});

test('basic-custom: Mailchimp-style userLiteral=anystring + passField=apiKey', async () => {
  const helpers = makeHelpers({ apiKey: 'abc-us5' });
  await helpers.requestWithAuthentication('basic-custom', {
    method: 'GET',
    url: 'https://us5.api.mailchimp.com/3.0/lists',
    userLiteral: 'anystring',
    passField: 'apiKey',
  });
  const expected = `Basic ${Buffer.from('anystring:abc-us5').toString('base64')}`;
  assert.equal(captured[0].headers.Authorization, expected);
});

test('basic-custom: both user + pass empty throws', async () => {
  const helpers = makeHelpers({});
  await assert.rejects(
    helpers.requestWithAuthentication('basic-custom', {
      method: 'GET',
      url: 'https://api.example/x',
      userField: 'missing',
      passField: 'alsoMissing',
    }),
    /both username and password resolved empty/,
  );
});

/* ── requestWithAuthentication: raw ─────────────────────────────────────── */

test('raw auth: sends Authorization verbatim (no Bearer prefix) for Linear', async () => {
  const helpers = makeHelpers({ apiKey: 'lin_api_xyz' });
  await helpers.requestWithAuthentication('raw', {
    method: 'POST',
    url: 'https://api.linear.app/graphql',
    tokenField: 'apiKey',
  });
  assert.equal(captured[0].headers.Authorization, 'lin_api_xyz');
});

test('raw auth: missing credential field throws', async () => {
  const helpers = makeHelpers({ otherField: 'x' });
  await assert.rejects(
    helpers.requestWithAuthentication('raw', {
      method: 'GET',
      url: 'https://api.example/x',
      tokenField: 'apiKey',
    }),
    /missing field "apiKey"/,
  );
});

/* ── requestWithAuthentication: query-param ─────────────────────────────── */

test('query-param: Pipedrive ?api_token=... and no Authorization header', async () => {
  const helpers = makeHelpers({ apiToken: 'pd_xyz' });
  await helpers.requestWithAuthentication('query-param', {
    method: 'GET',
    url: 'https://api.pipedrive.com/v1/deals',
    paramName: 'api_token',
    tokenField: 'apiToken',
  });
  const u = new URL(captured[0].url);
  assert.equal(u.searchParams.get('api_token'), 'pd_xyz');
  assert.equal(captured[0].headers.Authorization, undefined);
});

test('query-param: missing paramName throws', async () => {
  const helpers = makeHelpers({ apiToken: 'x' });
  await assert.rejects(
    helpers.requestWithAuthentication('query-param', {
      method: 'GET',
      url: 'https://api.example/x',
      tokenField: 'apiToken',
    }),
    /req\.paramName is required/,
  );
});

test('query-param: missing tokenField throws', async () => {
  const helpers = makeHelpers({ apiToken: 'x' });
  await assert.rejects(
    helpers.requestWithAuthentication('query-param', {
      method: 'GET',
      url: 'https://api.example/x',
      paramName: 'api_token',
    }),
    /req\.tokenField is required/,
  );
});

test('query-param: missing credential field throws (and never leaks the value)', async () => {
  const helpers = makeHelpers({ otherField: 'x' });
  await assert.rejects(
    helpers.requestWithAuthentication('query-param', {
      method: 'GET',
      url: 'https://api.example/x',
      paramName: 'api_token',
      tokenField: 'apiToken',
    }),
    (err: unknown) => {
      const msg = (err as Error).message;
      assert.match(msg, /missing field "apiToken"/);
      // Hard guard: a missing-field error must never accidentally include a
      // partially-resolved token value.
      assert.equal(msg.includes('=x'), false);
      return true;
    },
  );
});

/* ── requestWithAuthentication: path-segment ────────────────────────────── */

test('path-segment: Telegram-style bot{token}/sendMessage substitution + URL-encoding', async () => {
  // Telegram bot tokens contain a `:` (e.g. `123:abc`) which must not break
  // out of the path segment — `encodeURIComponent` turns it into `%3A`.
  const helpers = makeHelpers({ apiToken: '123:abc' });
  await helpers.requestWithAuthentication('path-segment', {
    method: 'POST',
    url: 'unused-when-template-set',
    urlTemplate: 'https://api.telegram.org/bot{token}/sendMessage',
  });
  assert.equal(captured[0].url, 'https://api.telegram.org/bot123%3Aabc/sendMessage');
  // No Authorization header — the URL itself carries the secret.
  assert.equal(captured[0].headers.Authorization, undefined);
});

test('path-segment: custom pathParams substitute non-credential placeholders', async () => {
  const helpers = makeHelpers({ apiToken: 'tok' });
  await helpers.requestWithAuthentication('path-segment', {
    method: 'POST',
    url: 'unused',
    urlTemplate: 'https://api.telegram.org/bot{token}/{method}',
    pathParams: { method: 'sendPhoto' },
  });
  assert.equal(captured[0].url, 'https://api.telegram.org/bottok/sendPhoto');
});

test('path-segment: tokenField override (Slack-style botToken in path)', async () => {
  const helpers = makeHelpers({ botToken: 'xyz' });
  await helpers.requestWithAuthentication('path-segment', {
    method: 'GET',
    url: 'unused',
    urlTemplate: 'https://api.example/v1/{token}/me',
    tokenField: 'botToken',
  });
  assert.equal(captured[0].url, 'https://api.example/v1/xyz/me');
});

test('path-segment: pathParams values are URL-encoded too (no path-injection)', async () => {
  const helpers = makeHelpers({ apiToken: 'tok' });
  await helpers.requestWithAuthentication('path-segment', {
    method: 'POST',
    url: 'unused',
    urlTemplate: 'https://api.example/{token}/{name}',
    pathParams: { name: 'a/b c' },
  });
  assert.equal(captured[0].url, 'https://api.example/tok/a%2Fb%20c');
});

test('path-segment: missing urlTemplate throws', async () => {
  const helpers = makeHelpers({ apiToken: 'tok' });
  await assert.rejects(
    helpers.requestWithAuthentication('path-segment', {
      method: 'POST',
      url: 'https://api.example/x',
    }),
    /req\.urlTemplate is required/,
  );
});

test('path-segment: missing credential field throws (and never leaks the value)', async () => {
  // The error must surface the field NAME (`apiToken`) but never the value
  // we tried to splice — defends against leaking tokens through logs.
  const helpers = makeHelpers({ otherField: 'super-secret-leak-canary' });
  await assert.rejects(
    helpers.requestWithAuthentication('path-segment', {
      method: 'POST',
      url: 'unused',
      urlTemplate: 'https://api.example/bot{token}/x',
    }),
    (err: unknown) => {
      const msg = (err as Error).message;
      assert.match(msg, /missing field "apiToken"/);
      assert.equal(msg.includes('super-secret-leak-canary'), false);
      return true;
    },
  );
});

test('path-segment: missing pathParams placeholder throws without token value', async () => {
  // Make sure throws raised by placeholder substitution never carry the
  // already-resolved token value either.
  const helpers = makeHelpers({ apiToken: 'leak-canary-token' });
  await assert.rejects(
    helpers.requestWithAuthentication('path-segment', {
      method: 'POST',
      url: 'unused',
      urlTemplate: 'https://api.example/bot{token}/{method}',
    }),
    (err: unknown) => {
      const msg = (err as Error).message;
      assert.match(msg, /missing pathParams\["method"\]/);
      assert.equal(msg.includes('leak-canary-token'), false);
      return true;
    },
  );
});
