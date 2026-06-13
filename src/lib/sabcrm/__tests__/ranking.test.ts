/**
 * Unit tests for the PURE fractional-ranking helpers (`../ranking`).
 *   npx tsx --test src/lib/sabcrm/__tests__/ranking.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateKeyBetween,
  generateNKeysBetween,
  rebalance,
  sortByRank,
  isValidKey,
  DIGITS,
  BASE,
} from '../ranking';

/** Assert a generated key is valid and strictly within its (open) bounds. */
function assertBetween(
  key: string,
  a: string | null,
  b: string | null,
): void {
  assert.ok(isValidKey(key), `key ${JSON.stringify(key)} should be valid`);
  if (a != null) assert.ok(a < key, `expected ${a} < ${key}`);
  if (b != null) assert.ok(key < b, `expected ${key} < ${b}`);
}

describe('generateKeyBetween — basic bounds', () => {
  it('null/null produces a valid mid key', () => {
    const k = generateKeyBetween(null, null);
    assert.ok(isValidKey(k));
  });

  it('a/null sorts strictly after a', () => {
    const a = generateKeyBetween(null, null);
    const k = generateKeyBetween(a, null);
    assertBetween(k, a, null);
  });

  it('null/b sorts strictly before b', () => {
    const b = generateKeyBetween(null, null);
    const k = generateKeyBetween(null, b);
    assertBetween(k, null, b);
  });

  it('a/b sorts strictly between a and b', () => {
    const a = generateKeyBetween(null, null);
    const c = generateKeyBetween(a, null);
    const mid = generateKeyBetween(a, c);
    assertBetween(mid, a, c);
  });

  it('handles adjacent single-char neighbours by descending a level', () => {
    // "1" and "2" are adjacent base-62 digits with no digit between them.
    const k = generateKeyBetween('1', '2');
    assertBetween(k, '1', '2');
    assert.ok(k.length >= 2, 'should lengthen when no single digit fits');
  });
});

describe('generateKeyBetween — strict ordering after many inserts', () => {
  it('keeps strict order when always inserting at the FRONT', () => {
    let first = generateKeyBetween(null, null);
    const keys = [first];
    for (let i = 0; i < 500; i++) {
      const k = generateKeyBetween(null, first);
      assertBetween(k, null, first);
      first = k;
      keys.unshift(k);
    }
    assertStrictlySorted(keys);
  });

  it('keeps strict order when always inserting at the END', () => {
    let last = generateKeyBetween(null, null);
    const keys = [last];
    for (let i = 0; i < 500; i++) {
      const k = generateKeyBetween(last, null);
      assertBetween(k, last, null);
      last = k;
      keys.push(k);
    }
    assertStrictlySorted(keys);
  });

  it('keeps strict order when always inserting into the SAME middle gap', () => {
    let lo = generateKeyBetween(null, null);
    let hi = generateKeyBetween(lo, null);
    const collected: string[] = [];
    for (let i = 0; i < 500; i++) {
      const k = generateKeyBetween(lo, hi);
      assertBetween(k, lo, hi);
      collected.push(k);
      // Alternate which side of the new key we keep squeezing.
      if (i % 2 === 0) hi = k;
      else lo = k;
    }
    // Each successive squeeze still produced a value inside the live gap.
    assert.equal(collected.length, 500);
  });

  it('survives a randomised insert sequence and stays sorted', () => {
    // Deterministic PRNG so the test is reproducible.
    let seed = 1234567;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    const list: string[] = [generateKeyBetween(null, null)];
    for (let i = 0; i < 1000; i++) {
      const pos = Math.floor(rand() * (list.length + 1));
      const a = pos > 0 ? list[pos - 1] : null;
      const b = pos < list.length ? list[pos] : null;
      const k = generateKeyBetween(a, b);
      assertBetween(k, a, b);
      list.splice(pos, 0, k);
    }
    assert.equal(list.length, 1001);
    assertStrictlySorted(list);
    // Every key is unique.
    assert.equal(new Set(list).size, list.length);
  });
});

describe('generateNKeysBetween', () => {
  it('returns [] for n <= 0', () => {
    assert.deepEqual(generateNKeysBetween(null, null, 0), []);
    assert.deepEqual(generateNKeysBetween(null, null, -3), []);
  });

  it('returns n strictly-ordered keys within bounds', () => {
    const a = generateKeyBetween(null, null);
    const b = generateKeyBetween(a, null);
    const keys = generateNKeysBetween(a, b, 25);
    assert.equal(keys.length, 25);
    for (const k of keys) assertBetween(k, a, b);
    assertStrictlySorted(keys);
  });

  it('open-ended batch (null/null) is strictly ordered + unique', () => {
    const keys = generateNKeysBetween(null, null, 100);
    assert.equal(keys.length, 100);
    assertStrictlySorted(keys);
    assert.equal(new Set(keys).size, 100);
  });
});

describe('rebalance', () => {
  it('produces evenly-spaced keys preserving input order', () => {
    const items = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ];
    const out = rebalance(items);
    assert.equal(out.length, 4);
    assert.deepEqual(
      out.map((o) => o.id),
      ['a', 'b', 'c', 'd'],
    );
    assertStrictlySorted(out.map((o) => o.rank));
    for (const o of out) assert.ok(isValidKey(o.rank));
  });

  it('returns [] for an empty list', () => {
    assert.deepEqual(rebalance([]), []);
  });
});

describe('sortByRank', () => {
  it('orders by rank ascending, un-ranked items last (stable)', () => {
    const rows = [
      { id: 'x', rank: 'V' },
      { id: 'noRank1' },
      { id: 'y', rank: 'A' },
      { id: 'bad', rank: '###' },
      { id: 'noRank2', rank: null },
    ];
    const sorted = sortByRank(rows).map((r) => r.id);
    // Valid ranks first ('A' < 'V'), then unranked/invalid in original order.
    assert.deepEqual(sorted, ['y', 'x', 'noRank1', 'bad', 'noRank2']);
  });

  it('does not mutate the input array', () => {
    const rows = [{ id: 'a', rank: 'z' }, { id: 'b', rank: '1' }];
    const copy = [...rows];
    sortByRank(rows);
    assert.deepEqual(rows, copy);
  });
});

describe('isValidKey', () => {
  it('rejects empties, non-base62, and trailing-min-digit keys', () => {
    assert.equal(isValidKey(''), false);
    assert.equal(isValidKey('V'), true);
    assert.equal(isValidKey('V0'), false); // redundant trailing min digit
    assert.equal(isValidKey('a-b'), false);
    assert.equal(isValidKey(DIGITS[BASE - 1]), true);
  });
});

/** Assert an array of keys is strictly ascending under string comparison. */
function assertStrictlySorted(keys: ReadonlyArray<string>): void {
  for (let i = 1; i < keys.length; i++) {
    assert.ok(
      keys[i - 1] < keys[i],
      `not strictly sorted at ${i}: ${keys[i - 1]} !< ${keys[i]}`,
    );
  }
}
