/**
 * Unit tests for the PURE (no-DOM) helpers of the SabCRM offline read cache
 * (`../offline-cache`): cache-key building/parsing, TTL expiry math, TTL
 * pruning and LRU eviction selection, and record normalisation.
 *
 *   npx tsx --test src/lib/sabcrm/__tests__/offline-cache.test.ts
 *
 * The IndexedDB methods are intentionally NOT exercised here — there is no DB
 * in the node test runtime, and every DB method is documented to no-op there;
 * `isIndexedDbAvailable()` returning false is asserted as the proof.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_TTL_MS,
  MAX_ENTRIES,
  buildCacheKey,
  parseCacheKey,
  isExpired,
  pruneExpired,
  selectEvictions,
  toCachedRecord,
  isIndexedDbAvailable,
  type CachedRecord,
} from '../offline-cache';

const mk = (key: string, cachedAt: number): CachedRecord => {
  const p = parseCacheKey(key);
  return {
    key,
    objectSlug: p?.objectSlug ?? '',
    recordId: p?.recordId ?? '',
    data: {},
    cachedAt,
  };
};

describe('buildCacheKey / parseCacheKey', () => {
  it('round-trips a simple object:id pair', () => {
    const k = buildCacheKey('opportunities', 'abc123');
    assert.equal(k, 'opportunities:abc123');
    assert.deepEqual(parseCacheKey(k), {
      objectSlug: 'opportunities',
      recordId: 'abc123',
    });
  });

  it('strips separators from the slug so it cannot forge another namespace', () => {
    // A hostile slug "a:b" must not become the "a" namespace with id "b:<id>".
    const k = buildCacheKey('a:b', 'x');
    assert.equal(k, 'ab:x');
    assert.deepEqual(parseCacheKey(k), { objectSlug: 'ab', recordId: 'x' });
  });

  it('keeps separators that appear inside the record id', () => {
    const k = buildCacheKey('contacts', 'id:with:colons');
    assert.deepEqual(parseCacheKey(k), {
      objectSlug: 'contacts',
      recordId: 'id:with:colons',
    });
  });

  it('coerces non-string inputs', () => {
    assert.equal(buildCacheKey(123 as unknown as string, 456 as unknown as string), '123:456');
  });

  it('returns null for malformed keys', () => {
    assert.equal(parseCacheKey('nocolon'), null);
    assert.equal(parseCacheKey(':leading'), null);
    assert.equal(parseCacheKey('trailing:'), null);
    assert.equal(parseCacheKey(123 as unknown as string), null);
  });
});

describe('isExpired', () => {
  const now = 1_000_000_000_000;

  it('false when within the TTL window', () => {
    assert.equal(isExpired({ cachedAt: now - 1000 }, now, 10_000), false);
  });

  it('true when older than the TTL window', () => {
    assert.equal(isExpired({ cachedAt: now - 20_000 }, now, 10_000), true);
  });

  it('treats a missing/invalid cachedAt as expired', () => {
    assert.equal(isExpired({ cachedAt: NaN }, now, 10_000), true);
    assert.equal(
      isExpired({ cachedAt: undefined as unknown as number }, now, 10_000),
      true,
    );
  });

  it('a non-positive / infinite TTL disables expiry', () => {
    assert.equal(isExpired({ cachedAt: 0 }, now, 0), false);
    assert.equal(isExpired({ cachedAt: 0 }, now, -1), false);
    assert.equal(isExpired({ cachedAt: 0 }, now, Infinity), false);
  });

  it('boundary: exactly at the edge is NOT expired (strict >)', () => {
    assert.equal(isExpired({ cachedAt: now - 10_000 }, now, 10_000), false);
    assert.equal(isExpired({ cachedAt: now - 10_001 }, now, 10_000), true);
  });
});

describe('pruneExpired', () => {
  const now = 100_000;
  it('partitions kept vs expired keys and drops junk entries', () => {
    const entries: CachedRecord[] = [
      mk('o:fresh', now - 1000),
      mk('o:stale', now - 50_000),
      mk('o:alsoFresh', now - 2000),
      // junk: no string key
      { ...mk('x:y', now), key: undefined as unknown as string },
    ];
    const { keep, expiredKeys } = pruneExpired(entries, now, 10_000);
    assert.deepEqual(
      keep.map((e) => e.key).sort(),
      ['o:alsoFresh', 'o:fresh'],
    );
    assert.deepEqual(expiredKeys, ['o:stale']);
  });

  it('handles an empty/undefined list', () => {
    assert.deepEqual(pruneExpired([], now, 10_000), { keep: [], expiredKeys: [] });
    assert.deepEqual(
      pruneExpired(undefined as unknown as CachedRecord[], now, 10_000),
      { keep: [], expiredKeys: [] },
    );
  });
});

describe('selectEvictions (LRU)', () => {
  it('returns nothing when at or under the cap', () => {
    const entries = [mk('o:a', 3), mk('o:b', 1), mk('o:c', 2)];
    assert.deepEqual(selectEvictions(entries, 3), []);
    assert.deepEqual(selectEvictions(entries, 5), []);
  });

  it('evicts the oldest cachedAt first, leaving exactly `max`', () => {
    const entries = [
      mk('o:newest', 30),
      mk('o:oldest', 10),
      mk('o:mid', 20),
    ];
    // cap 1 → drop the two oldest
    assert.deepEqual(selectEvictions(entries, 1).sort(), ['o:mid', 'o:oldest']);
    // cap 2 → drop only the single oldest
    assert.deepEqual(selectEvictions(entries, 2), ['o:oldest']);
  });

  it('breaks cachedAt ties deterministically by key', () => {
    const entries = [mk('o:b', 5), mk('o:a', 5), mk('o:c', 5)];
    // all tied → keep 1 → evict the two lexicographically-smallest keys
    assert.deepEqual(selectEvictions(entries, 1).sort(), ['o:a', 'o:b']);
  });

  it('a non-positive cap evicts everything', () => {
    const entries = [mk('o:a', 1), mk('o:b', 2)];
    assert.deepEqual(selectEvictions(entries, 0).sort(), ['o:a', 'o:b']);
  });
});

describe('toCachedRecord', () => {
  it('normalises a CRM record into a snapshot', () => {
    const out = toCachedRecord(
      { _id: 'r1', object: 'contacts', label: 'Ada', data: { name: 'Ada' } },
      555,
    );
    assert.deepEqual(out, {
      key: 'contacts:r1',
      objectSlug: 'contacts',
      recordId: 'r1',
      label: 'Ada',
      data: { name: 'Ada' },
      cachedAt: 555,
    });
  });

  it('defaults a missing/invalid data bag to {} and label to undefined', () => {
    const out = toCachedRecord(
      { _id: 'r2', object: 'deals', data: null as unknown as Record<string, unknown> },
      1,
    );
    assert.equal(out?.label, undefined);
    assert.deepEqual(out?.data, {});
  });

  it('returns null without an id or object', () => {
    assert.equal(toCachedRecord({ _id: '', object: 'x', data: {} }), null);
    assert.equal(toCachedRecord({ _id: 'x', object: '', data: {} }), null);
    assert.equal(
      toCachedRecord(null as unknown as { _id: string; object: string; data: Record<string, unknown> }),
      null,
    );
  });
});

describe('constants + environment guard', () => {
  it('exposes sane defaults', () => {
    assert.ok(DEFAULT_TTL_MS > 0);
    assert.equal(DEFAULT_TTL_MS, 7 * 24 * 60 * 60 * 1000);
    assert.ok(MAX_ENTRIES > 0);
  });

  it('reports IndexedDB as unavailable in the node test runtime (DB methods no-op)', () => {
    assert.equal(isIndexedDbAvailable(), false);
  });
});
