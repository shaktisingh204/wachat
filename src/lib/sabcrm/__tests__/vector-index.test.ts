/**
 * Unit tests for the pure vector math (`../vector-index`).
 *   npx tsx --test src/lib/sabcrm/__tests__/vector-index.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cosineSim, topKByCosine } from '../vector-index';

describe('cosineSim', () => {
  it('1 for identical, ~0 for orthogonal, -1 for opposite', () => {
    assert.equal(cosineSim([1, 0], [1, 0]), 1);
    assert.equal(cosineSim([1, 0], [0, 1]), 0);
    assert.equal(cosineSim([1, 0], [-1, 0]), -1);
  });
  it('is scale-invariant', () => {
    assert.ok(Math.abs(cosineSim([1, 1], [2, 2]) - 1) < 1e-9);
  });
  it('returns 0 on dim mismatch or a zero vector (never NaN)', () => {
    assert.equal(cosineSim([1, 0, 0], [1, 0]), 0);
    assert.equal(cosineSim([0, 0], [1, 1]), 0);
    assert.equal(cosineSim([], []), 0);
  });
});

describe('topKByCosine', () => {
  const rows = [
    { recordId: 'a', object: 'people', vector: [1, 0], dim: 2 },
    { recordId: 'b', object: 'people', vector: [0.9, 0.1], dim: 2 },
    { recordId: 'c', object: 'people', vector: [0, 1], dim: 2 }, // orthogonal → score 0 → dropped
    { recordId: 'd', object: 'people', vector: [1, 0, 0], dim: 3 }, // wrong dim → skipped
  ];
  it('ranks by similarity, drops non-positive + wrong-dim, respects topK', () => {
    const out = topKByCosine([1, 0], rows, 2, 2);
    assert.deepEqual(out.map((r) => r.recordId), ['a', 'b']);
    assert.ok(out[0].score >= out[1].score);
    // c (orthogonal, score 0) and d (dim 3) excluded
    assert.ok(!out.some((r) => r.recordId === 'c' || r.recordId === 'd'));
  });
  it('topK caps the result', () => {
    assert.equal(topKByCosine([1, 0], rows, 1, 2).length, 1);
  });
});
