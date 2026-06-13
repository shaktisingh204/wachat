/**
 * Unit tests for ./ml-calibration.ts — PURE math (node:test, no I/O).
 *
 * Run: npx tsx --test src/lib/sabcrm/__tests__/ml-calibration.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  plattScaling,
  applyPlatt,
  isotonicRegression,
  applyIsotonic,
  brierScore,
  reliabilityBins,
  expectedCalibrationError,
  featureContributions,
} from '../ml-calibration';

/** Build a synthetic mis-calibrated set: raw scores rank correctly but are
 *  over-confident (squashed toward 0/1). Outcomes follow a true sigmoid of the
 *  underlying signal so calibration is recoverable. Deterministic LCG. */
function syntheticMiscalibrated(n: number): {
  scores: number[];
  labels: number[];
  trueP: number[];
} {
  let seed = 12345;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const scores: number[] = [];
  const labels: number[] = [];
  const trueP: number[] = [];
  for (let i = 0; i < n; i++) {
    // signal in [-3, 3]
    const signal = (i / (n - 1)) * 6 - 3;
    const p = 1 / (1 + Math.exp(-signal)); // true win prob
    // raw score is an over-confident, monotone-but-warped version of p:
    // push p toward extremes via p^? then add small noise. Keep ordered.
    const overconf = Math.pow(p, 0.45); // squashes mid-range upward → biased
    const rawScore = signal * 1.7; // logit-space, wrong slope (a≈?)
    scores.push(rawScore);
    trueP.push(p);
    labels.push(rand() < p ? 1 : 0);
    void overconf;
  }
  return { scores, labels, trueP };
}

/* -------------------------------------------------------------------------- */
/* Platt scaling                                                              */
/* -------------------------------------------------------------------------- */

test('plattScaling: map is monotone increasing in the raw score', () => {
  const { scores, labels } = syntheticMiscalibrated(400);
  const params = plattScaling(scores, labels);
  // a should be positive for a correctly-ordered model.
  assert.ok(params.a > 0, `expected positive slope, got a=${params.a}`);
  // sample the map across the score range; it must be non-decreasing.
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  let prev = -Infinity;
  for (let t = 0; t <= 20; t++) {
    const s = lo + ((hi - lo) * t) / 20;
    const p = applyPlatt(s, params);
    assert.ok(p >= prev - 1e-9, `not monotone at s=${s}: ${p} < ${prev}`);
    assert.ok(p >= 0 && p <= 1, `p out of range: ${p}`);
    prev = p;
  }
});

test('plattScaling: improves Brier vs the raw sigmoid(score) baseline', () => {
  const { scores, labels } = syntheticMiscalibrated(600);
  // Baseline: treat raw logit-space score through a plain sigmoid (wrong slope).
  const baseline = scores.map((s) => 1 / (1 + Math.exp(-s)));
  const params = plattScaling(scores, labels);
  const calibrated = scores.map((s) => applyPlatt(s, params));

  const brierBase = brierScore(baseline, labels);
  const brierCal = brierScore(calibrated, labels);
  assert.ok(
    brierCal <= brierBase + 1e-9,
    `calibration did not improve Brier: base=${brierBase} cal=${brierCal}`,
  );
});

test('plattScaling: degenerate inputs return identity map', () => {
  assert.deepEqual(plattScaling([], []), { a: 1, b: 0 });
  assert.deepEqual(plattScaling([0.1], [1]), { a: 1, b: 0 });
  // single class → nothing to learn
  assert.deepEqual(plattScaling([0.1, 0.2, 0.3], [1, 1, 1]), { a: 1, b: 0 });
});

/* -------------------------------------------------------------------------- */
/* Isotonic regression                                                       */
/* -------------------------------------------------------------------------- */

test('isotonicRegression: produces a monotone non-decreasing step function', () => {
  const { scores, labels } = syntheticMiscalibrated(300);
  const iso = isotonicRegression(scores, labels);
  for (let i = 1; i < iso.y.length; i++) {
    assert.ok(
      iso.y[i] >= iso.y[i - 1] - 1e-12,
      `isotonic not monotone at ${i}: ${iso.y[i]} < ${iso.y[i - 1]}`,
    );
  }
  for (let i = 1; i < iso.x.length; i++) {
    assert.ok(iso.x[i] >= iso.x[i - 1], 'breakpoints must be ascending');
  }
  // applying across the range stays monotone and bounded.
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  let prev = -Infinity;
  for (let t = 0; t <= 30; t++) {
    const s = lo + ((hi - lo) * t) / 30;
    const p = applyIsotonic(s, iso);
    assert.ok(p >= prev - 1e-9, `applyIsotonic not monotone at s=${s}`);
    assert.ok(p >= 0 && p <= 1, `p out of range: ${p}`);
    prev = p;
  }
});

test('isotonicRegression: recovers a clean monotone relationship', () => {
  // perfectly ordered, no noise: outcome = (score > 0)
  const scores = [-3, -2, -1, -0.5, 0.5, 1, 2, 3];
  const labels = [0, 0, 0, 0, 1, 1, 1, 1];
  const iso = isotonicRegression(scores, labels);
  assert.ok(applyIsotonic(-2, iso) < 0.5, 'low score should map low');
  assert.ok(applyIsotonic(2, iso) > 0.5, 'high score should map high');
  // Brier on the fit should be ~0 for this separable set.
  const fitted = scores.map((s) => applyIsotonic(s, iso));
  assert.ok(brierScore(fitted, labels) < 1e-6, 'separable set should fit cleanly');
});

test('isotonicRegression: pools adjacent violators', () => {
  // a single violation in the middle must be pooled into a flat region.
  const scores = [1, 2, 3, 4];
  const labels = [0, 1, 0, 1]; // 2 and 3 violate monotonicity → pool to 0.5
  const iso = isotonicRegression(scores, labels);
  // somewhere in the middle the value should be the pooled 0.5.
  const mid = applyIsotonic(2.5, iso);
  assert.ok(Math.abs(mid - 0.5) < 1e-9, `expected pooled 0.5, got ${mid}`);
});

/* -------------------------------------------------------------------------- */
/* Quality metrics                                                            */
/* -------------------------------------------------------------------------- */

test('brierScore: known values', () => {
  assert.equal(brierScore([1, 0], [1, 0]), 0); // perfect
  assert.equal(brierScore([0.5, 0.5], [1, 0]), 0.25); // pure guess
  assert.ok(Number.isNaN(brierScore([], [])));
});

test('reliabilityBins / ECE: a perfectly calibrated set has ~0 ECE', () => {
  // construct probs equal to observed rate per bin
  const probs: number[] = [];
  const labels: number[] = [];
  // bin centered at 0.2: 10 items, 2 wins; at 0.8: 10 items, 8 wins
  for (let i = 0; i < 10; i++) {
    probs.push(0.2);
    labels.push(i < 2 ? 1 : 0);
  }
  for (let i = 0; i < 10; i++) {
    probs.push(0.8);
    labels.push(i < 8 ? 1 : 0);
  }
  const bins = reliabilityBins(probs, labels, 10);
  assert.ok(bins.length >= 2, 'should have at least two populated bins');
  const ece = expectedCalibrationError(probs, labels, 10);
  assert.ok(ece < 1e-9, `expected ~0 ECE, got ${ece}`);
});

/* -------------------------------------------------------------------------- */
/* Feature contributions                                                      */
/* -------------------------------------------------------------------------- */

test('featureContributions: sum of contributions + bias reconstructs the logit', () => {
  const weights = [0.8, -0.5, 0.3];
  const bias = 0.1;
  const features = [10, 4, 7];
  const mean = [5, 5, 5];
  const std = [2, 2, 2];
  const bd = featureContributions(weights, bias, features, mean, std);

  // recompute the logit independently
  let z = bias;
  for (let j = 0; j < weights.length; j++) {
    z += weights[j] * ((features[j] - mean[j]) / std[j]);
  }
  assert.ok(
    Math.abs(bd.total + bd.bias - z) < 1e-9,
    `total+bias=${bd.total + bd.bias} should equal logit=${z}`,
  );
  // total field must equal the sum of contributions
  const summed = bd.contributions.reduce((s, c) => s + c.contribution, 0);
  assert.ok(Math.abs(summed - bd.total) < 1e-9, 'total must equal Σ contributions');
});

test('featureContributions: sorted by |contribution| and split by sign', () => {
  const weights = [0.8, -0.5, 0.3];
  const bias = 0;
  const features = [10, 9, 6]; // standardized: +2.5, +2.0, +0.5
  const mean = [5, 5, 5];
  const std = [2, 2, 2];
  const bd = featureContributions(weights, bias, features, mean, std, [
    'amount',
    'age',
    'owner',
  ]);

  // sorted descending by absolute contribution
  for (let i = 1; i < bd.contributions.length; i++) {
    assert.ok(
      Math.abs(bd.contributions[i - 1].contribution) >=
        Math.abs(bd.contributions[i].contribution) - 1e-12,
      'contributions must be sorted by |value| descending',
    );
  }
  // feature 1 (weight -0.5, value +2.0) is the only negative driver
  assert.equal(bd.topNegative.length, 1);
  assert.equal(bd.topNegative[0].name, 'age');
  assert.ok(bd.topNegative[0].contribution < 0);
  // positives present and strongest-first
  assert.ok(bd.topPositive.length >= 1);
  for (let i = 1; i < bd.topPositive.length; i++) {
    assert.ok(
      bd.topPositive[i - 1].contribution >= bd.topPositive[i].contribution,
      'topPositive strongest-first',
    );
  }
  // names propagate
  assert.equal(bd.contributions.find((c) => c.index === 0)?.name, 'amount');
});
