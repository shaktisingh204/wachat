/**
 * V2.13 — API-key test-mode (sandbox key) pure-core tests.
 *
 *   npx tsx --test src/lib/sabsms/apikeys/apikeys-mode.test.ts
 *
 * Mongo-free: exercises only the pure prefix/mode helpers added to ./core.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  hashApiKey,
  isWellFormedApiKey,
  isWellFormedAnyApiKey,
  mintApiKey,
  modeFromRawKey,
  prefixForMode,
  SABSMS_KEY_LIVE_PREFIX,
  SABSMS_KEY_TEST_PREFIX,
} from './core';

describe('prefixForMode / modeFromRawKey', () => {
  it('maps modes to prefixes', () => {
    assert.equal(prefixForMode('live'), SABSMS_KEY_LIVE_PREFIX);
    assert.equal(prefixForMode('test'), SABSMS_KEY_TEST_PREFIX);
  });

  it('recovers the mode a raw key claims by prefix', () => {
    assert.equal(modeFromRawKey(`sk_live_${'A'.repeat(32)}`), 'live');
    assert.equal(modeFromRawKey(`sk_test_${'A'.repeat(32)}`), 'test');
    assert.equal(modeFromRawKey('pk_live_xyz'), null);
    assert.equal(modeFromRawKey('garbage'), null);
  });
});

describe('mintApiKey (mode)', () => {
  it('defaults to a live sk_live_ key (back-compat)', () => {
    const minted = mintApiKey();
    assert.ok(minted.rawKey.startsWith('sk_live_'));
    assert.equal(minted.mode, 'live');
    assert.equal(minted.keyHash, hashApiKey(minted.rawKey));
  });

  it('mints a sk_test_ sandbox key when mode=test', () => {
    const minted = mintApiKey(undefined, 'test');
    assert.ok(minted.rawKey.startsWith('sk_test_'));
    assert.equal(minted.rawKey.length, 'sk_test_'.length + 32);
    assert.equal(minted.mode, 'test');
    assert.equal(minted.prefix, minted.rawKey.slice(0, 12));
    assert.equal(minted.keyHash, hashApiKey(minted.rawKey));
    assert.match(minted.keyHash, /^[0-9a-f]{64}$/);
  });

  it('preserves the randomChar-first deterministic signature', () => {
    const minted = mintApiKey(() => 'A', 'test');
    assert.equal(minted.rawKey, `sk_test_${'A'.repeat(32)}`);
  });
});

describe('well-formed checks', () => {
  it('isWellFormedApiKey stays live-ONLY (locked invariant)', () => {
    assert.equal(isWellFormedApiKey(`sk_live_${'A'.repeat(32)}`), true);
    assert.equal(isWellFormedApiKey(`sk_test_${'A'.repeat(32)}`), false);
  });

  it('isWellFormedAnyApiKey accepts either prefix', () => {
    assert.equal(isWellFormedAnyApiKey(`sk_live_${'A'.repeat(32)}`), true);
    assert.equal(isWellFormedAnyApiKey(`sk_test_${'A'.repeat(32)}`), true);
    assert.equal(isWellFormedAnyApiKey(`sk_test_${'A'.repeat(31)}!`), false);
    assert.equal(isWellFormedAnyApiKey('pk_live_xyz'), false);
  });
});
