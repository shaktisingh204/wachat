/**
 * mintOAuthAccessToken — focused tests for the OAuth2 refresh-token helper.
 *
 *   npx tsx --test src/lib/sabflow/forge/__tests__/oauth-refresh.test.ts
 */
import { strict as assert } from 'node:assert';
import { test, beforeEach } from 'node:test';

import {
  _clearOAuthTokenCacheForTests,
  mintOAuthAccessToken,
} from '../oauth-refresh';

type CapturedCall = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
};

let captured: CapturedCall[] = [];
let nextResponses: Array<{ status: number; body: unknown }> = [];

function installMockFetch() {
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const headers = (init?.headers as Record<string, string>) ?? {};
    captured.push({
      url,
      method: init?.method ?? 'GET',
      headers,
      body: (init?.body as string | undefined) ?? '',
    });
    const next = nextResponses.shift();
    if (!next) {
      throw new Error('mock fetch: no response queued');
    }
    const bodyStr = typeof next.body === 'string' ? next.body : JSON.stringify(next.body);
    return new Response(bodyStr, {
      status: next.status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  captured = [];
  nextResponses = [];
  _clearOAuthTokenCacheForTests();
  installMockFetch();
});

const credential = {
  clientId: 'cid-abc',
  clientSecret: 'sec-xyz',
  refreshToken: 'rtok-111',
};

const config = { tokenUrl: 'https://oauth2.googleapis.com/token' };

/* ── happy path ─────────────────────────────────────────────────────────── */

test('mints a token on first call → caches it', async () => {
  nextResponses.push({
    status: 200,
    body: { access_token: 'atok-fresh', expires_in: 3600, token_type: 'Bearer' },
  });

  const token = await mintOAuthAccessToken(credential, config);
  assert.equal(token, 'atok-fresh');
  assert.equal(captured.length, 1);
  assert.equal(captured[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(captured[0].method, 'POST');
  assert.equal(
    captured[0].headers['Content-Type'],
    'application/x-www-form-urlencoded',
  );

  // Body is form-encoded and carries the required RFC 6749 fields.
  const params = new URLSearchParams(captured[0].body);
  assert.equal(params.get('grant_type'), 'refresh_token');
  assert.equal(params.get('refresh_token'), 'rtok-111');
  assert.equal(params.get('client_id'), 'cid-abc');
  assert.equal(params.get('client_secret'), 'sec-xyz');
});

test('second call within expiry → returns cached without re-fetching', async () => {
  nextResponses.push({
    status: 200,
    body: { access_token: 'atok-cached', expires_in: 3600 },
  });

  const first = await mintOAuthAccessToken(credential, config);
  const second = await mintOAuthAccessToken(credential, config);

  assert.equal(first, 'atok-cached');
  assert.equal(second, 'atok-cached');
  assert.equal(captured.length, 1, 'fetch should be called exactly once');
});

/* ── failure paths ──────────────────────────────────────────────────────── */

test('missing refreshToken throws a clear error', async () => {
  await assert.rejects(
    () =>
      mintOAuthAccessToken(
        { clientId: 'cid', clientSecret: 'sec' },
        config,
      ),
    /credential missing field "refreshToken"/,
  );
  assert.equal(captured.length, 0);
});

test('missing clientId throws', async () => {
  await assert.rejects(
    () =>
      mintOAuthAccessToken(
        { clientSecret: 'sec', refreshToken: 'rtok-111' },
        config,
      ),
    /credential missing field "clientId"/,
  );
});

test('missing clientSecret throws', async () => {
  await assert.rejects(
    () =>
      mintOAuthAccessToken(
        { clientId: 'cid', refreshToken: 'rtok-111' },
        config,
      ),
    /credential missing field "clientSecret"/,
  );
});

test('non-200 from token endpoint throws with body', async () => {
  nextResponses.push({
    status: 400,
    body: { error: 'invalid_grant', error_description: 'Token expired' },
  });

  await assert.rejects(
    () => mintOAuthAccessToken(credential, config),
    (err: Error) => {
      assert.match(err.message, /token endpoint returned HTTP 400/);
      assert.match(err.message, /invalid_grant/);
      return true;
    },
  );
});

test('expired cached token → re-mints on next call', async () => {
  // First mint: a token with a TTL shorter than the safety margin (60s).
  // It will be considered expired immediately and force a re-mint.
  nextResponses.push({
    status: 200,
    body: { access_token: 'atok-shortlived', expires_in: 30 },
  });
  nextResponses.push({
    status: 200,
    body: { access_token: 'atok-refreshed', expires_in: 3600 },
  });

  const first = await mintOAuthAccessToken(credential, config);
  const second = await mintOAuthAccessToken(credential, config);

  assert.equal(first, 'atok-shortlived');
  assert.equal(second, 'atok-refreshed');
  assert.equal(captured.length, 2, 'expired token should trigger a re-mint');
});

/* ── custom field names ─────────────────────────────────────────────────── */

test('honours custom credential field names', async () => {
  nextResponses.push({
    status: 200,
    body: { access_token: 'atok-custom', expires_in: 3600 },
  });

  const token = await mintOAuthAccessToken(
    { app_id: 'aid', app_secret: 'asec', rt: 'rt-zzz' },
    {
      tokenUrl: 'https://example.test/oauth/token',
      clientIdField: 'app_id',
      clientSecretField: 'app_secret',
      refreshTokenField: 'rt',
    },
  );

  assert.equal(token, 'atok-custom');
  const params = new URLSearchParams(captured[0].body);
  assert.equal(params.get('client_id'), 'aid');
  assert.equal(params.get('client_secret'), 'asec');
  assert.equal(params.get('refresh_token'), 'rt-zzz');
});

test('response without access_token throws', async () => {
  nextResponses.push({
    status: 200,
    body: { token_type: 'Bearer' /* no access_token */ },
  });

  await assert.rejects(
    () => mintOAuthAccessToken(credential, config),
    /response missing access_token/,
  );
});

test('error body redacts any echoed access_token/refresh_token strings', async () => {
  nextResponses.push({
    status: 401,
    body: {
      error: 'invalid_client',
      access_token: 'leaked-token-should-be-redacted',
      refresh_token: 'also-leaked',
    },
  });

  await assert.rejects(
    () => mintOAuthAccessToken(credential, config),
    (err: Error) => {
      assert.doesNotMatch(err.message, /leaked-token-should-be-redacted/);
      assert.doesNotMatch(err.message, /also-leaked/);
      assert.match(err.message, /REDACTED/);
      return true;
    },
  );
});
