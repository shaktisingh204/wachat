/**
 * Pure unit tests for `src/lib/ops/slo.ts` and `src/lib/ops/error-budget.ts`.
 * Run with:  npx tsx --test src/lib/ops/__tests__/slo.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    BURN_RATE_FAST_THRESHOLD,
    BURN_RATE_SLOW_THRESHOLD,
    evaluateBurnRate,
    rollingErrorBudget,
} from '../error-budget';
import { evaluate, toErrorBudget, windowToMs } from '../slo';
import type { SliSample, Slo } from '../types';

const baseSlo: Slo = {
    id: 'api-availability',
    target: 0.99,
    window: '28d',
    indicators: [{ id: 'http-2xx', name: 'HTTP 2xx ratio', type: 'availability' }],
};

test('evaluate() returns full achievement when there are no bad events', () => {
    const samples: SliSample[] = [
        { timestamp: 0, good: 100, total: 100 },
        { timestamp: 1, good: 50, total: 50 },
    ];
    const result = evaluate(baseSlo, samples);
    assert.equal(result.achievement, 1);
    assert.equal(result.errorBudgetRemaining, 1);
    assert.equal(result.burnRate, 0);
});

test('evaluate() computes burn-rate correctly when on-target', () => {
    // Exactly 1% bad, target 99% — burn-rate should be 1.0.
    const samples: SliSample[] = [{ timestamp: 0, good: 99, total: 100 }];
    const result = evaluate(baseSlo, samples);
    assert.ok(Math.abs(result.achievement - 0.99) < 1e-9);
    assert.ok(Math.abs(result.burnRate - 1) < 1e-9);
    assert.ok(result.errorBudgetRemaining < 1e-9);
});

test('evaluate() reports >1 burn-rate when over budget', () => {
    // 5% bad on a 99% target → burn-rate = 5x.
    const samples: SliSample[] = [{ timestamp: 0, good: 95, total: 100 }];
    const result = evaluate(baseSlo, samples);
    assert.ok(Math.abs(result.burnRate - 5) < 1e-9);
    assert.equal(result.errorBudgetRemaining, 0);
});

test('evaluate() throws on invalid target', () => {
    const bad: Slo = { ...baseSlo, target: 0 };
    assert.throws(() => evaluate(bad, []));
    const bad2: Slo = { ...baseSlo, target: 1 };
    assert.throws(() => evaluate(bad2, []));
});

test('toErrorBudget() reflects evaluation correctly', () => {
    const samples: SliSample[] = [{ timestamp: 0, good: 99, total: 100 }];
    const evaluation = evaluate(baseSlo, samples);
    const budget = toErrorBudget(baseSlo, evaluation, 12345);
    assert.equal(budget.sloId, baseSlo.id);
    assert.equal(budget.window, baseSlo.window);
    assert.ok(Math.abs(budget.total - 0.01) < 1e-9);
    assert.equal(budget.computedAt, 12345);
});

test('windowToMs() produces expected values', () => {
    assert.equal(windowToMs('1h'), 3_600_000);
    assert.equal(windowToMs('28d'), 28 * 24 * 3_600_000);
});

test('rollingErrorBudget() filters samples by window', () => {
    const now = 100_000_000_000;
    const inside = now - 1_000;
    const outside = now - windowToMs('28d') - 1_000;
    const samples: SliSample[] = [
        { timestamp: outside, good: 0, total: 1_000 }, // ignored
        { timestamp: inside, good: 99, total: 100 },
    ];
    const budget = rollingErrorBudget(baseSlo, samples, now);
    // Only the in-window 99/100 should count → on-target.
    assert.ok(Math.abs(budget.burnRate - 1) < 1e-9);
});

test('evaluateBurnRate() flags fast-burn alerts', () => {
    const now = 1_000_000_000;
    const oneHourAgo = now - 30 * 60 * 1_000; // inside 1h window
    // 50% bad in 1h on a 99% target → burn rate = 50x → fast burn.
    const samples: SliSample[] = [{ timestamp: oneHourAgo, good: 50, total: 100 }];
    const alert = evaluateBurnRate(baseSlo, samples, { now });
    assert.equal(alert.severity, 'fast');
    assert.ok(alert.fast.burnRate > BURN_RATE_FAST_THRESHOLD);
});

test('evaluateBurnRate() returns ok when within thresholds', () => {
    const now = 1_000_000_000;
    // Mostly-healthy traffic in the last 6h — burn-rate well below thresholds.
    const samples: SliSample[] = [
        { timestamp: now - 3_600_000, good: 999, total: 1_000 },
        { timestamp: now - 60_000, good: 999, total: 1_000 },
    ];
    const alert = evaluateBurnRate(baseSlo, samples, { now });
    assert.equal(alert.severity, 'ok');
    assert.ok(alert.fast.burnRate <= BURN_RATE_FAST_THRESHOLD);
    assert.ok(alert.slow.burnRate <= BURN_RATE_SLOW_THRESHOLD);
});
