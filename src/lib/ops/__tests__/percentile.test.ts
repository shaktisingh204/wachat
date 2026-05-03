/**
 * Pure unit tests for `src/lib/ops/rum.ts` percentile math.
 * Run with:  npx tsx --test src/lib/ops/__tests__/percentile.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { metricSnapshot, percentile, percentiles, RumStore } from '../rum';

test('percentile() handles single-element input', () => {
    assert.equal(percentile([42], 0.5), 42);
    assert.equal(percentile([42], 0.95), 42);
});

test('percentile() linearly interpolates between ranks', () => {
    // For [1..10], p50 (linear interpolation) = 5.5
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.ok(Math.abs(percentile(values, 0.5) - 5.5) < 1e-9);
    assert.ok(Math.abs(percentile(values, 0) - 1) < 1e-9);
    assert.ok(Math.abs(percentile(values, 1) - 10) < 1e-9);
});

test('percentile() returns NaN for empty input', () => {
    assert.ok(Number.isNaN(percentile([], 0.5)));
});

test('percentiles() emits min/max/mean alongside quantiles', () => {
    const snap = percentiles([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    assert.equal(snap.count, 10);
    assert.equal(snap.min, 10);
    assert.equal(snap.max, 100);
    assert.equal(snap.mean, 55);
    // Sanity: p95 should be between max and the second-highest value.
    assert.ok(snap.p95 >= 90 && snap.p95 <= 100);
});

test('percentiles() is order-insensitive', () => {
    const a = percentiles([1, 2, 3, 4, 5]);
    const b = percentiles([5, 3, 1, 4, 2]);
    assert.equal(a.p50, b.p50);
    assert.equal(a.p95, b.p95);
    assert.equal(a.min, b.min);
    assert.equal(a.max, b.max);
});

test('RumStore caps capacity per metric', () => {
    const store = new RumStore(3);
    for (let i = 0; i < 10; i++) {
        store.ingest({ id: `e${i}`, sessionId: 's', timestamp: i, url: '/', metric: 'LCP', value: i });
    }
    assert.equal(store.size('LCP'), 3);
    // Should retain the most recent 3.
    const values = store.valuesFor('LCP');
    assert.deepEqual(values.sort((a, b) => a - b), [7, 8, 9]);
});

test('metricSnapshot() filters by since timestamp', () => {
    const store = new RumStore();
    for (let i = 0; i < 100; i++) {
        store.ingest({ id: `e${i}`, sessionId: 's', timestamp: i, url: '/', metric: 'INP', value: i });
    }
    const snap = metricSnapshot(store, 'INP', 50);
    assert.equal(snap.count, 50); // timestamps 50..99
    assert.equal(snap.min, 50);
    assert.equal(snap.max, 99);
});
