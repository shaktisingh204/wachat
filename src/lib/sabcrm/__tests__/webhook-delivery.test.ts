/**
 * Unit tests for the PURE webhook-delivery helpers.
 *
 * Run: `npx tsx --test src/lib/sabcrm/__tests__/webhook-delivery.test.ts`
 *
 * No Mongo / no fetch — only the deterministic signing + retry math.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import {
  signPayload,
  verifySignature,
  parseSignatureHeader,
  canonicalBody,
  backoffDelayMs,
  shouldRetry,
  isSuccessStatus,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  DEFAULT_MAX_ATTEMPTS,
  SIGNATURE_VERSION,
} from '../webhook-delivery.ts';

const SECRET = 'whsec_test_0123456789abcdef';

/* -------------------------------------------------------------------------- */
/* canonicalBody                                                               */
/* -------------------------------------------------------------------------- */

test('canonicalBody passes strings through verbatim', () => {
  assert.equal(canonicalBody('{"a":1}'), '{"a":1}');
});

test('canonicalBody JSON-stringifies objects and null', () => {
  assert.equal(canonicalBody({ a: 1, b: 'x' }), '{"a":1,"b":"x"}');
  assert.equal(canonicalBody(null), 'null');
  assert.equal(canonicalBody(undefined), 'null');
});

/* -------------------------------------------------------------------------- */
/* signPayload                                                                  */
/* -------------------------------------------------------------------------- */

test('signPayload emits the t=<ts>,v1=<hex> shape', () => {
  const sig = signPayload({ hello: 'world' }, SECRET, 1700000000);
  assert.match(sig, /^t=1700000000,v1=[0-9a-f]{64}$/);
});

test('signPayload is deterministic for the same inputs', () => {
  const a = signPayload({ x: 1 }, SECRET, 1700000000);
  const b = signPayload({ x: 1 }, SECRET, 1700000000);
  assert.equal(a, b);
});

test('signPayload folds the timestamp into the MAC (replay protection)', () => {
  const a = signPayload({ x: 1 }, SECRET, 1700000000);
  const b = signPayload({ x: 1 }, SECRET, 1700000001);
  assert.notEqual(a, b, 'different timestamps must produce different signatures');
});

test('signPayload truncates fractional timestamps', () => {
  const a = signPayload({ x: 1 }, SECRET, 1700000000.99);
  const b = signPayload({ x: 1 }, SECRET, 1700000000);
  assert.equal(a, b);
});

test('signPayload throws without a secret', () => {
  assert.throws(() => signPayload({ x: 1 }, '', 1700000000), /secret is required/);
});

test('signPayload digest matches a hand-computed HMAC over t=<ts>.<body>', () => {
  const body = { event: 'record.created', id: 'abc' };
  const ts = 1700000000;
  const expected = createHmac('sha256', SECRET)
    .update(`t=${ts}.${JSON.stringify(body)}`, 'utf8')
    .digest('hex');
  assert.equal(signPayload(body, SECRET, ts), `t=${ts},${SIGNATURE_VERSION}=${expected}`);
});

/* -------------------------------------------------------------------------- */
/* parseSignatureHeader                                                         */
/* -------------------------------------------------------------------------- */

test('parseSignatureHeader extracts timestamp + signature', () => {
  const parsed = parseSignatureHeader('t=1700000000,v1=deadbeef');
  assert.deepEqual(parsed, { timestamp: 1700000000, signature: 'deadbeef' });
});

test('parseSignatureHeader tolerates extra whitespace and ordering', () => {
  const parsed = parseSignatureHeader(' v1=abc , t=42 ');
  assert.deepEqual(parsed, { timestamp: 42, signature: 'abc' });
});

test('parseSignatureHeader returns null on malformed input', () => {
  assert.equal(parseSignatureHeader(''), null);
  assert.equal(parseSignatureHeader('garbage'), null);
  assert.equal(parseSignatureHeader('t=42'), null, 'missing v1 → null');
  assert.equal(parseSignatureHeader('v1=abc'), null, 'missing t → null');
  // @ts-expect-error — exercising the runtime guard
  assert.equal(parseSignatureHeader(undefined), null);
});

/* -------------------------------------------------------------------------- */
/* verifySignature                                                             */
/* -------------------------------------------------------------------------- */

test('verifySignature accepts a signature it produced', () => {
  const body = { event: 'record.updated', n: 7 };
  const sig = signPayload(body, SECRET, 1700000000);
  assert.equal(verifySignature(body, SECRET, sig), true);
});

test('verifySignature rejects a tampered body', () => {
  const sig = signPayload({ amount: 100 }, SECRET, 1700000000);
  assert.equal(verifySignature({ amount: 999 }, SECRET, sig), false);
});

test('verifySignature rejects a wrong secret', () => {
  const body = { x: 1 };
  const sig = signPayload(body, SECRET, 1700000000);
  assert.equal(verifySignature(body, 'whsec_other', sig), false);
});

test('verifySignature rejects when secret is empty or header malformed', () => {
  assert.equal(verifySignature({ x: 1 }, '', 't=1,v1=ab'), false);
  assert.equal(verifySignature({ x: 1 }, SECRET, 'nope'), false);
});

test('verifySignature enforces the freshness window when asked', () => {
  const body = { x: 1 };
  const ts = 1700000000;
  const sig = signPayload(body, SECRET, ts);
  // Within tolerance.
  assert.equal(
    verifySignature(body, SECRET, sig, { toleranceSeconds: 300, nowSeconds: ts + 100 }),
    true,
  );
  // Outside tolerance.
  assert.equal(
    verifySignature(body, SECRET, sig, { toleranceSeconds: 300, nowSeconds: ts + 9999 }),
    false,
  );
  // Tolerance 0 (default) skips the check entirely — old timestamp still passes.
  assert.equal(verifySignature(body, SECRET, sig, { nowSeconds: ts + 1e9 }), true);
});

test('verifySignature rejects a same-length non-hex signature without throwing', () => {
  const body = { x: 1 };
  const real = signPayload(body, SECRET, 1700000000);
  const { signature } = parseSignatureHeader(real)!;
  // Replace the hex with same-length junk that is not valid hex.
  const junk = 'z'.repeat(signature.length);
  assert.equal(verifySignature(body, SECRET, `t=1700000000,v1=${junk}`), false);
});

/* -------------------------------------------------------------------------- */
/* backoffDelayMs                                                              */
/* -------------------------------------------------------------------------- */

test('backoffDelayMs doubles deterministically from the base', () => {
  assert.equal(backoffDelayMs(1), BASE_BACKOFF_MS);
  assert.equal(backoffDelayMs(2), BASE_BACKOFF_MS * 2);
  assert.equal(backoffDelayMs(3), BASE_BACKOFF_MS * 4);
  assert.equal(backoffDelayMs(4), BASE_BACKOFF_MS * 8);
});

test('backoffDelayMs caps at MAX_BACKOFF_MS and never overflows', () => {
  assert.equal(backoffDelayMs(100), MAX_BACKOFF_MS);
  assert.equal(backoffDelayMs(1000), MAX_BACKOFF_MS);
  assert.ok(Number.isFinite(backoffDelayMs(1_000_000)));
  assert.equal(backoffDelayMs(1_000_000), MAX_BACKOFF_MS);
});

test('backoffDelayMs clamps non-positive / non-finite attempts to the base', () => {
  assert.equal(backoffDelayMs(0), BASE_BACKOFF_MS);
  assert.equal(backoffDelayMs(-5), BASE_BACKOFF_MS);
  assert.equal(backoffDelayMs(Number.NaN), BASE_BACKOFF_MS);
});

/* -------------------------------------------------------------------------- */
/* shouldRetry                                                                  */
/* -------------------------------------------------------------------------- */

test('shouldRetry retries transport errors (null status) within budget', () => {
  assert.equal(shouldRetry(null, 1, 6), true);
  assert.equal(shouldRetry(null, 5, 6), true);
});

test('shouldRetry retries 408/425/429 and any 5xx', () => {
  for (const s of [408, 425, 429, 500, 502, 503, 599]) {
    assert.equal(shouldRetry(s, 1, 6), true, `status ${s} should retry`);
  }
});

test('shouldRetry does NOT retry 2xx (success) or other 4xx', () => {
  for (const s of [200, 201, 204]) {
    assert.equal(shouldRetry(s, 1, 6), false, `status ${s} is success`);
  }
  for (const s of [400, 401, 403, 404, 410, 422]) {
    assert.equal(shouldRetry(s, 1, 6), false, `status ${s} is terminal`);
  }
});

test('shouldRetry stops once the attempt budget is exhausted', () => {
  assert.equal(shouldRetry(500, 6, 6), false, 'no retry on the final attempt');
  assert.equal(shouldRetry(null, 6, 6), false);
  assert.equal(shouldRetry(503, 7, 6), false, 'over budget → false');
});

test('shouldRetry defaults to DEFAULT_MAX_ATTEMPTS', () => {
  assert.equal(shouldRetry(500, DEFAULT_MAX_ATTEMPTS - 1), true);
  assert.equal(shouldRetry(500, DEFAULT_MAX_ATTEMPTS), false);
});

/* -------------------------------------------------------------------------- */
/* isSuccessStatus                                                             */
/* -------------------------------------------------------------------------- */

test('isSuccessStatus is true only for 2xx', () => {
  assert.equal(isSuccessStatus(200), true);
  assert.equal(isSuccessStatus(299), true);
  assert.equal(isSuccessStatus(300), false);
  assert.equal(isSuccessStatus(404), false);
  assert.equal(isSuccessStatus(null), false);
});
