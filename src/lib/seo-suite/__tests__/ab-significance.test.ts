/**
 * Tests for the A/B significance helpers.
 *
 *   pnpm exec tsx --test src/lib/seo-suite/__tests__/ab-significance.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  assignVariant,
  chiSquarePValue1df,
  chiSquareSignificance,
  fnv1a,
  makeVariant,
  normalizeWeights,
} from '../ab-testing';

test('chiSquarePValue1df: returns 1 for non-positive input', () => {
  assert.equal(chiSquarePValue1df(0), 1);
  assert.equal(chiSquarePValue1df(-5), 1);
});

test('chiSquarePValue1df: known values are within tolerance', () => {
  // p(X^2 > 3.841) ≈ 0.05 for df=1
  const p05 = chiSquarePValue1df(3.841);
  assert.ok(Math.abs(p05 - 0.05) < 0.005, `expected ~0.05, got ${p05}`);
  // p(X^2 > 6.635) ≈ 0.01
  const p01 = chiSquarePValue1df(6.635);
  assert.ok(Math.abs(p01 - 0.01) < 0.005, `expected ~0.01, got ${p01}`);
  // p(X^2 > 10.828) ≈ 0.001
  const p001 = chiSquarePValue1df(10.828);
  assert.ok(p001 < 0.005, `expected <0.005, got ${p001}`);
});

test('chiSquareSignificance: detects clearly significant lift', () => {
  const control = { ...makeVariant('a', 'A'), visitors: 10000, conversions: 500 }; // 5%
  const treatment = { ...makeVariant('b', 'B'), visitors: 10000, conversions: 700 }; // 7%
  const result = chiSquareSignificance(control, treatment);
  assert.ok(result.chiSquare > 30, `chi-square should be large, got ${result.chiSquare}`);
  assert.ok(result.pValue < 0.001, `expected p<0.001, got ${result.pValue}`);
  assert.equal(result.isSignificant, true);
  assert.ok(Math.abs(result.lift - 0.4) < 0.001);
});

test('chiSquareSignificance: small/equal samples are not significant', () => {
  const control = { ...makeVariant('a', 'A'), visitors: 100, conversions: 10 };
  const treatment = { ...makeVariant('b', 'B'), visitors: 100, conversions: 11 };
  const r = chiSquareSignificance(control, treatment);
  assert.equal(r.isSignificant, false);
  assert.ok(r.pValue > 0.05, `expected p>0.05, got ${r.pValue}`);
});

test('chiSquareSignificance: handles zero-visitor edge case', () => {
  const control = { ...makeVariant('a', 'A'), visitors: 0, conversions: 0 };
  const treatment = { ...makeVariant('b', 'B'), visitors: 0, conversions: 0 };
  const r = chiSquareSignificance(control, treatment);
  assert.equal(r.pValue, 1);
  assert.equal(r.isSignificant, false);
  assert.equal(r.sampleSize, 0);
  assert.equal(r.chiSquare, 0);
});

test('chiSquareSignificance: Yates correction shrinks chi-square', () => {
  const control = { ...makeVariant('a', 'A'), visitors: 50, conversions: 10 };
  const treatment = { ...makeVariant('b', 'B'), visitors: 50, conversions: 20 };
  const noYates = chiSquareSignificance(control, treatment, { yates: false });
  const yates = chiSquareSignificance(control, treatment, { yates: true });
  assert.ok(yates.chiSquare < noYates.chiSquare, 'Yates correction must reduce chi-square');
  assert.ok(yates.pValue >= noYates.pValue);
});

test('assignVariant: deterministic for the same visitor', () => {
  const variants = [makeVariant('a', 'A', 0.5), makeVariant('b', 'B', 0.5)];
  const v1 = assignVariant('visitor-123', variants, { testId: 'test-1' });
  const v2 = assignVariant('visitor-123', variants, { testId: 'test-1' });
  assert.equal(v1.id, v2.id);
});

test('assignVariant: roughly honors variant weights at scale', () => {
  const variants = [makeVariant('a', 'A', 0.2), makeVariant('b', 'B', 0.8)];
  const counts: Record<string, number> = { a: 0, b: 0 };
  const N = 5000;
  for (let i = 0; i < N; i++) {
    const v = assignVariant(`v-${i}`, variants, { testId: 'weighting' });
    counts[v.id] = (counts[v.id] ?? 0) + 1;
  }
  const aShare = counts.a / N;
  const bShare = counts.b / N;
  assert.ok(Math.abs(aShare - 0.2) < 0.04, `A share ${aShare} drifted from 0.2`);
  assert.ok(Math.abs(bShare - 0.8) < 0.04, `B share ${bShare} drifted from 0.8`);
});

test('assignVariant: different testIds split the same visitor differently', () => {
  const variants = [makeVariant('a', 'A', 0.5), makeVariant('b', 'B', 0.5)];
  let differing = 0;
  for (let i = 0; i < 200; i++) {
    const v1 = assignVariant(`vid-${i}`, variants, { testId: 'exp-1' });
    const v2 = assignVariant(`vid-${i}`, variants, { testId: 'exp-2' });
    if (v1.id !== v2.id) differing += 1;
  }
  // Should be ~100, definitely not 0 (which would imply correlated assignment).
  assert.ok(differing > 60 && differing < 140, `expected ~half differing, got ${differing}`);
});

test('assignVariant: zero-weight variants fall back to uniform', () => {
  const variants = [makeVariant('a', 'A', 0), makeVariant('b', 'B', 0)];
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 1000; i++) {
    const v = assignVariant(`u-${i}`, variants, { testId: 'zero' });
    counts[v.id]++;
  }
  assert.ok(counts.a > 350 && counts.b > 350, `uniform fallback should split ~50/50, got ${JSON.stringify(counts)}`);
});

test('assignVariant: throws when no variants provided', () => {
  assert.throws(() => assignVariant('v', [], { testId: 't' }));
});

test('normalizeWeights: returns weights summing to 1', () => {
  const variants = [makeVariant('a', 'A', 1), makeVariant('b', 'B', 3)];
  const w = normalizeWeights(variants);
  assert.ok(Math.abs(w[0] - 0.25) < 1e-9);
  assert.ok(Math.abs(w[1] - 0.75) < 1e-9);
});

test('fnv1a: stable, deterministic, non-zero on non-empty inputs', () => {
  assert.equal(fnv1a('abc'), fnv1a('abc'));
  assert.notEqual(fnv1a('abc'), fnv1a('abd'));
  assert.ok(fnv1a('hello world') >>> 0 > 0);
});
