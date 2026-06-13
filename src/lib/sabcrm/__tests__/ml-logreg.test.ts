/**
 * Unit tests for the in-house logistic regression (`../ml-logreg`).
 *   npx tsx --test src/lib/sabcrm/__tests__/ml-logreg.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sigmoid, fitScaler, trainLogReg, predictProba } from '../ml-logreg';

describe('sigmoid', () => {
  it('is 0.5 at 0, monotonic, bounded, NaN-free at extremes', () => {
    assert.equal(sigmoid(0), 0.5);
    assert.ok(sigmoid(10) > 0.99 && sigmoid(10) < 1);
    assert.ok(sigmoid(-10) > 0 && sigmoid(-10) < 0.01);
    assert.ok(Number.isFinite(sigmoid(1000)) && Number.isFinite(sigmoid(-1000)));
  });
});

describe('fitScaler', () => {
  it('computes mean + std, floors std to 1 for constant features', () => {
    const { mean, std } = fitScaler([
      [0, 5],
      [2, 5],
      [4, 5],
    ]);
    assert.equal(mean[0], 2);
    assert.equal(mean[1], 5);
    assert.ok(std[0] > 0);
    assert.equal(std[1], 1); // constant column → std floored to 1
  });
});

describe('trainLogReg + predictProba', () => {
  it('learns a linearly separable boundary (x0 + x1 > 0)', () => {
    const X: number[][] = [];
    const y: number[] = [];
    // deterministic grid (no RNG) so the test is stable
    for (let a = -5; a <= 5; a++) {
      for (let b = -5; b <= 5; b++) {
        if (a === 0 && b === 0) continue;
        X.push([a, b]);
        y.push(a + b > 0 ? 1 : 0);
      }
    }
    const model = trainLogReg(X, y, { epochs: 500, lr: 0.3 });
    assert.equal(model.n, X.length);
    // Clear positives / negatives classify correctly.
    assert.ok(predictProba([4, 4], model) > 0.8);
    assert.ok(predictProba([-4, -4], model) < 0.2);
    assert.ok(predictProba([5, 1], model) > 0.5);
    assert.ok(predictProba([-5, -1], model) < 0.5);
  });

  it('handles empty / zero-feature input without throwing', () => {
    const m = trainLogReg([], []);
    assert.equal(m.n, 0);
    assert.equal(predictProba([], m), 0.5); // bias 0 → sigmoid(0)
  });
});
