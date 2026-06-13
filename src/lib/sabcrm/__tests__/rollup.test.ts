/**
 * Unit tests for the rollup PURE reducer (`../rollup`).
 *   npx tsx --test src/lib/sabcrm/__tests__/rollup.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { computeRollup } from '../rollup';

describe('computeRollup', () => {
  it('count = number of children (ignores values)', () => {
    assert.equal(computeRollup('count', [{}, {}, {}]), 3);
    assert.equal(computeRollup('count', []), 0);
  });
  it('sum / avg / min / max over coerced numeric values', () => {
    assert.equal(computeRollup('sum', [10, '20', 30]), 60);
    assert.equal(computeRollup('avg', [10, 20, 30]), 20);
    assert.equal(computeRollup('min', [10, 5, 30]), 5);
    assert.equal(computeRollup('max', [10, 5, 30]), 30);
  });
  it('coerces currency objects + ignores non-numeric', () => {
    assert.equal(computeRollup('sum', [{ amountMicros: 5_000_000 }, 'abc', 3]), 8);
    assert.equal(computeRollup('sum', ['x', null, undefined]), 0);
  });
  it('empty (non-count) → 0', () => {
    assert.equal(computeRollup('avg', []), 0);
    assert.equal(computeRollup('max', []), 0);
  });
  it('rounds sum/avg to 6 dp', () => {
    assert.equal(computeRollup('avg', [1, 2]), 1.5);
    assert.equal(computeRollup('sum', [0.1, 0.2]), 0.3);
  });
});
