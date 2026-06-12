/**
 * Unit tests for the SabSMS webhook-URL builder + credential masking
 * (`../webhook-urls.ts` — pure helpers, no DB, no server-only).
 *
 *   npx tsx --test src/lib/sabsms/__tests__/webhook-urls.test.ts
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  buildSabsmsWebhookUrls,
  maskCredentialValue,
  resolveSabsmsWebhookBase,
} from '../webhook-urls';

// ─── resolveSabsmsWebhookBase ─────────────────────────────────────────────

test('base falls back to localhost:4002 when no env set', () => {
  assert.equal(resolveSabsmsWebhookBase({}), 'http://localhost:4002');
});

test('base prefers SABSMS_ENGINE_PUBLIC_URL over SABSMS_ENGINE_URL', () => {
  assert.equal(
    resolveSabsmsWebhookBase({
      SABSMS_ENGINE_PUBLIC_URL: 'https://sms.sabnode.com',
      SABSMS_ENGINE_URL: 'http://10.0.0.5:4002',
    }),
    'https://sms.sabnode.com',
  );
});

test('base uses SABSMS_ENGINE_URL when no public URL', () => {
  assert.equal(
    resolveSabsmsWebhookBase({ SABSMS_ENGINE_URL: 'http://10.0.0.5:4002' }),
    'http://10.0.0.5:4002',
  );
});

test('base strips trailing slashes', () => {
  assert.equal(
    resolveSabsmsWebhookBase({ SABSMS_ENGINE_PUBLIC_URL: 'https://sms.sabnode.com///' }),
    'https://sms.sabnode.com',
  );
});

// ─── buildSabsmsWebhookUrls ───────────────────────────────────────────────

test('builds inbound + dlr URLs on the given base', () => {
  const urls = buildSabsmsWebhookUrls(
    'twilio',
    '64f0c0ffee0ddba11ca7e600',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    'https://sms.sabnode.com',
  );
  assert.equal(
    urls.inbound,
    'https://sms.sabnode.com/webhook/twilio/64f0c0ffee0ddba11ca7e600/inbound?secret=a1b2c3d4e5f60718293a4b5c6d7e8f90',
  );
  assert.equal(
    urls.dlr,
    'https://sms.sabnode.com/webhook/twilio/64f0c0ffee0ddba11ca7e600/dlr?secret=a1b2c3d4e5f60718293a4b5c6d7e8f90',
  );
});

test('builder strips trailing slash from an explicit base', () => {
  const urls = buildSabsmsWebhookUrls('msg91', 'acc1', 'secret123', 'http://localhost:4002/');
  assert.equal(urls.inbound, 'http://localhost:4002/webhook/msg91/acc1/inbound?secret=secret123');
  assert.equal(urls.dlr, 'http://localhost:4002/webhook/msg91/acc1/dlr?secret=secret123');
});

test('builder URL-encodes path + secret components', () => {
  const urls = buildSabsmsWebhookUrls('a b', 'x/y', 's&=?', 'http://h');
  assert.equal(urls.inbound, 'http://h/webhook/a%20b/x%2Fy/inbound?secret=s%26%3D%3F');
  assert.equal(urls.dlr, 'http://h/webhook/a%20b/x%2Fy/dlr?secret=s%26%3D%3F');
});

test('builder reads env base when none passed', () => {
  const prevPublic = process.env.SABSMS_ENGINE_PUBLIC_URL;
  process.env.SABSMS_ENGINE_PUBLIC_URL = 'https://hooks.example.com/';
  try {
    const urls = buildSabsmsWebhookUrls('gupshup', 'acc2', 'sec');
    assert.equal(urls.inbound, 'https://hooks.example.com/webhook/gupshup/acc2/inbound?secret=sec');
  } finally {
    if (prevPublic === undefined) delete process.env.SABSMS_ENGINE_PUBLIC_URL;
    else process.env.SABSMS_ENGINE_PUBLIC_URL = prevPublic;
  }
});

// ─── maskCredentialValue ──────────────────────────────────────────────────

test('mask keeps first 2 + last 4 chars for long values', () => {
  assert.equal(maskCredentialValue('AC1234567890abcdef'), 'AC••••cdef');
  assert.equal(maskCredentialValue('supersecrettoken'), 'su••••oken');
});

test('mask handles exactly 8 chars', () => {
  assert.equal(maskCredentialValue('abcdefgh'), 'ab••••efgh');
});

test('mask fully hides values shorter than 8 chars', () => {
  assert.equal(maskCredentialValue('short'), '••••');
  assert.equal(maskCredentialValue('1234567'), '••••');
  assert.equal(maskCredentialValue('a'), '••••');
});

test('mask fully hides empty / non-string-ish values', () => {
  assert.equal(maskCredentialValue(''), '••••');
});

test('mask never leaks the middle of the value', () => {
  const secret = 'AAmiddleSECRETzzzz';
  const masked = maskCredentialValue(secret);
  assert.equal(masked.includes('middleSECRET'), false);
  assert.equal(masked, 'AA••••zzzz');
});
