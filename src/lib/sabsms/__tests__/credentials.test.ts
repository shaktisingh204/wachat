/**
 * Unit tests for the SabSMS credential cipher (`../credentials.ts`).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/credentials.test.ts
 *
 * Pure functions — no Mongo, no env (the key is passed explicitly).
 * NOTE: the repo's test runner is `tsx --test` (node:test), not vitest —
 * vitest is not installed in this workspace; this follows the convention
 * of e.g. `src/lib/compliance/__tests__/audit-chain.test.ts`.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { decryptProviderCreds, encryptProviderCreds } from '../credentials';

const KEY = 'a'.repeat(64); // 64 hex chars → 32 bytes
const OTHER_KEY = 'b'.repeat(64);
const WS = '665f1c2a9b3d4e5f60718293'; // workspaceId == user _id hex
const CREDS = { accountSid: 'ACxxxxxxxx', authToken: 'super-secret' };

test('round-trip: encrypt then decrypt returns the original blob', () => {
  const cipher = encryptProviderCreds(WS, CREDS, KEY);
  const out = decryptProviderCreds(WS, cipher, KEY);
  assert.deepEqual(out, CREDS);
});

test('cipher string matches the v1 wire format', () => {
  const cipher = encryptProviderCreds(WS, CREDS, KEY);
  const parts = cipher.split('.');
  assert.equal(parts.length, 3);
  assert.equal(parts[0], 'v1');
  // standard base64 with padding
  assert.match(parts[1], /^[A-Za-z0-9+/]+={0,2}$/);
  assert.match(parts[2], /^[A-Za-z0-9+/]+={0,2}$/);
  // nonce decodes to exactly 12 bytes
  assert.equal(Buffer.from(parts[1], 'base64').length, 12);
  // ciphertext carries at least the 16-byte appended auth tag
  assert.ok(Buffer.from(parts[2], 'base64').length >= 16);
});

test('nonce is random — two encryptions of the same blob differ', () => {
  const a = encryptProviderCreds(WS, CREDS, KEY);
  const b = encryptProviderCreds(WS, CREDS, KEY);
  assert.notEqual(a, b);
});

test('wrong workspaceId (AAD mismatch) fails authentication', () => {
  const cipher = encryptProviderCreds(WS, CREDS, KEY);
  assert.throws(
    () => decryptProviderCreds('ffffffffffffffffffffffff', cipher, KEY),
    /authentication failed/,
  );
});

test('wrong key fails authentication', () => {
  const cipher = encryptProviderCreds(WS, CREDS, KEY);
  assert.throws(() => decryptProviderCreds(WS, cipher, OTHER_KEY), /authentication failed/);
});

test('tampered ciphertext fails authentication', () => {
  const cipher = encryptProviderCreds(WS, CREDS, KEY);
  const [v, nonceB64, ctB64] = cipher.split('.');
  const ct = Buffer.from(ctB64, 'base64');
  ct[0] ^= 0xff; // flip a bit in the ciphertext body
  const tampered = `${v}.${nonceB64}.${ct.toString('base64')}`;
  assert.throws(() => decryptProviderCreds(WS, tampered, KEY), /authentication failed/);
});

test('tampered auth tag fails authentication', () => {
  const cipher = encryptProviderCreds(WS, CREDS, KEY);
  const [v, nonceB64, ctB64] = cipher.split('.');
  const ct = Buffer.from(ctB64, 'base64');
  ct[ct.length - 1] ^= 0x01; // flip a bit in the appended GCM tag
  const tampered = `${v}.${nonceB64}.${ct.toString('base64')}`;
  assert.throws(() => decryptProviderCreds(WS, tampered, KEY), /authentication failed/);
});

test('format validation: wrong part count / version / nonce / base64', () => {
  assert.throws(() => decryptProviderCreds(WS, 'not-a-cipher', KEY), /bad format/);
  assert.throws(() => decryptProviderCreds(WS, 'v1.only-two-parts', KEY), /bad format/);
  assert.throws(
    () => decryptProviderCreds(WS, 'v2.AAAAAAAAAAAAAAAA.AAAA', KEY),
    /unsupported version/,
  );
  // valid base64 but nonce is not 12 bytes
  const shortNonce = Buffer.alloc(4).toString('base64');
  assert.throws(
    () => decryptProviderCreds(WS, `v1.${shortNonce}.${'A'.repeat(24)}`, KEY),
    /nonce must be 12 bytes/,
  );
  // not base64 at all
  assert.throws(
    () => decryptProviderCreds(WS, 'v1.!!!!.AAAA', KEY),
    /not valid base64/,
  );
  // ciphertext shorter than the 16-byte tag
  const nonce = Buffer.alloc(12).toString('base64');
  const tiny = Buffer.alloc(4).toString('base64');
  assert.throws(
    () => decryptProviderCreds(WS, `v1.${nonce}.${tiny}`, KEY),
    /too short/,
  );
});

test('key validation: missing and malformed keys throw clear errors', () => {
  const saved = process.env.SABSMS_CREDS_KEY;
  delete process.env.SABSMS_CREDS_KEY;
  try {
    assert.throws(() => encryptProviderCreds(WS, CREDS), /SABSMS_CREDS_KEY is not set/);
  } finally {
    if (saved !== undefined) process.env.SABSMS_CREDS_KEY = saved;
  }
  assert.throws(() => encryptProviderCreds(WS, CREDS, 'deadbeef'), /64 hex characters/);
  assert.throws(() => encryptProviderCreds(WS, CREDS, 'g'.repeat(64)), /64 hex characters/);
});

test('input validation: workspaceId and blob are required', () => {
  assert.throws(() => encryptProviderCreds('', CREDS, KEY), /workspaceId is required/);
  assert.throws(
    () => encryptProviderCreds(WS, [] as unknown as Record<string, unknown>, KEY),
    /plain object/,
  );
  const cipher = encryptProviderCreds(WS, CREDS, KEY);
  assert.throws(() => decryptProviderCreds('', cipher, KEY), /workspaceId is required/);
});
