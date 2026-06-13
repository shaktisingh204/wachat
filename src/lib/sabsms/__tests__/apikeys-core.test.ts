/**
 * V2.13 — API-key pure core tests.
 *
 *   npx tsx --test src/lib/sabsms/__tests__/apikeys-core.test.ts
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  authorizeKey,
  clampRateLimitPerMin,
  DEFAULT_RATE_LIMIT_PER_MIN,
  hasScope,
  hashApiKey,
  ipAllowed,
  isSabsmsApiScope,
  isWellFormedApiKey,
  minuteBucket,
  mintApiKey,
  SABSMS_API_SCOPES,
  verifyApiKeyHash,
} from '../apikeys/core';

describe('mintApiKey', () => {
  it('mints sk_live_ + 32 base62 chars and a 12-char prefix', () => {
    const minted = mintApiKey();
    assert.ok(minted.rawKey.startsWith('sk_live_'));
    assert.equal(minted.rawKey.length, 'sk_live_'.length + 32);
    assert.ok(isWellFormedApiKey(minted.rawKey));
    assert.equal(minted.prefix, minted.rawKey.slice(0, 12));
    assert.equal(minted.keyHash, hashApiKey(minted.rawKey));
    // hex sha-256
    assert.match(minted.keyHash, /^[0-9a-f]{64}$/);
  });

  it('is deterministic under an injected RNG', () => {
    const minted = mintApiKey(() => 'A');
    assert.equal(minted.rawKey, `sk_live_${'A'.repeat(32)}`);
    assert.equal(
      minted.keyHash,
      // sha-256 of sk_live_AAAA…(32) — hand-computed fixture.
      'a2f6871139796af565b60374f1c2726eda3d28550d6547c99cd4616bb0fb31b0',
    );
  });

  it('rejects malformed keys', () => {
    assert.equal(isWellFormedApiKey('sk_live_short'), false);
    assert.equal(isWellFormedApiKey(`sk_test_${'A'.repeat(32)}`), false);
    assert.equal(isWellFormedApiKey(`sk_live_${'A'.repeat(31)}!`), false);
  });
});

describe('verifyApiKeyHash (constant-time)', () => {
  it('accepts the right key and rejects the wrong one', () => {
    const minted = mintApiKey();
    assert.equal(verifyApiKeyHash(minted.rawKey, minted.keyHash), true);
    assert.equal(verifyApiKeyHash(`${minted.rawKey}x`, minted.keyHash), false);
    assert.equal(verifyApiKeyHash(minted.rawKey, hashApiKey('other')), false);
  });

  it('never throws on malformed stored hashes (length mismatch guard)', () => {
    assert.equal(verifyApiKeyHash('sk_live_x', ''), false);
    assert.equal(verifyApiKeyHash('sk_live_x', 'abc'), false);
    assert.equal(verifyApiKeyHash('sk_live_x', 'zz'.repeat(32)), false);
  });
});

describe('ipAllowed', () => {
  it('empty allowlist allows any IP', () => {
    assert.equal(ipAllowed('1.2.3.4', undefined), true);
    assert.equal(ipAllowed('1.2.3.4', []), true);
  });

  it('exact and prefix entries', () => {
    assert.equal(ipAllowed('1.2.3.4', ['1.2.3.4']), true);
    assert.equal(ipAllowed('1.2.3.5', ['1.2.3.4']), false);
    assert.equal(ipAllowed('10.0.3.7', ['10.0.*']), true);
    assert.equal(ipAllowed('10.1.3.7', ['10.0.*']), false);
    assert.equal(ipAllowed('10.0.3.7', ['10.0.']), true);
  });

  it('non-empty allowlist rejects an unknown caller IP', () => {
    assert.equal(ipAllowed('', ['1.2.3.4']), false);
  });
});

describe('authorizeKey', () => {
  const minted = mintApiKey();
  const baseDoc = {
    keyHash: minted.keyHash,
    scopes: ['messages:send'],
  };

  it('accepts a valid live key', () => {
    assert.deepEqual(authorizeKey(baseDoc, { rawKey: minted.rawKey, ip: '9.9.9.9' }), {
      ok: true,
    });
  });

  it('rejects a revoked key', () => {
    const res = authorizeKey(
      { ...baseDoc, revokedAt: new Date() },
      { rawKey: minted.rawKey, ip: '9.9.9.9' },
    );
    assert.deepEqual(res, { ok: false, reason: 'revoked' });
  });

  it('rejects an IP outside the allowlist', () => {
    const res = authorizeKey(
      { ...baseDoc, ipAllowlist: ['1.2.3.4'] },
      { rawKey: minted.rawKey, ip: '9.9.9.9' },
    );
    assert.deepEqual(res, { ok: false, reason: 'ip_blocked' });
  });

  it('rejects a wrong key before checking anything else', () => {
    const res = authorizeKey(
      { ...baseDoc, revokedAt: new Date() },
      { rawKey: 'sk_live_wrong', ip: '9.9.9.9' },
    );
    assert.deepEqual(res, { ok: false, reason: 'bad_key' });
  });
});

describe('scopes', () => {
  it('catalogue is exactly the five V2.13 scopes', () => {
    assert.deepEqual(
      [...SABSMS_API_SCOPES],
      ['messages:send', 'messages:read', 'otp', 'webhooks:manage', 'analytics:read'],
    );
  });

  it('hasScope is explicit (no wildcard)', () => {
    assert.equal(hasScope(['messages:send'], 'messages:send'), true);
    assert.equal(hasScope(['messages:send'], 'messages:read'), false);
    assert.equal(hasScope(['*'], 'messages:read'), false);
  });

  it('isSabsmsApiScope filters unknown strings', () => {
    assert.equal(isSabsmsApiScope('otp'), true);
    assert.equal(isSabsmsApiScope('admin'), false);
  });
});

describe('clampRateLimitPerMin + minuteBucket', () => {
  it('clamps into [1, 10000] with the 300 default', () => {
    assert.equal(clampRateLimitPerMin(undefined), DEFAULT_RATE_LIMIT_PER_MIN);
    assert.equal(clampRateLimitPerMin(-5), DEFAULT_RATE_LIMIT_PER_MIN);
    assert.equal(clampRateLimitPerMin(0.5), DEFAULT_RATE_LIMIT_PER_MIN);
    assert.equal(clampRateLimitPerMin(1), 1);
    assert.equal(clampRateLimitPerMin(99999), 10_000);
    assert.equal(clampRateLimitPerMin('120'), 120);
  });

  it('minuteBucket floors to the UTC minute', () => {
    const d = new Date('2026-06-12T10:15:42.918Z');
    assert.equal(minuteBucket(d).toISOString(), '2026-06-12T10:15:00.000Z');
  });
});
