/**
 * Funnel computation tests. Pure unit tests — no IO, no Mongo.
 *
 *   npx tsx --test src/lib/analytics-suite/__tests__/funnel.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { computeFunnel } from '../funnels';
import type { FunnelEvent } from '../types';

const ev = (
    userId: string,
    name: string,
    ts: number,
    properties?: Record<string, unknown>,
): FunnelEvent => ({ userId, name, ts, properties });

test('computeFunnel returns empty result when steps is empty', () => {
    const result = computeFunnel(
        [ev('u1', 'view', 100), ev('u1', 'add_to_cart', 200)],
        [],
    );
    assert.equal(result.totalEntered, 0);
    assert.equal(result.totalCompleted, 0);
    assert.equal(result.steps.length, 0);
    assert.equal(result.overallConversion, 0);
});

test('computeFunnel computes per-step conversion with 100% completion', () => {
    const events: FunnelEvent[] = [
        ev('u1', 'view', 1),
        ev('u1', 'add_to_cart', 2),
        ev('u1', 'checkout', 3),
        ev('u2', 'view', 1),
        ev('u2', 'add_to_cart', 2),
        ev('u2', 'checkout', 3),
    ];
    const result = computeFunnel(events, ['view', 'add_to_cart', 'checkout']);
    assert.equal(result.totalEntered, 2);
    assert.equal(result.totalCompleted, 2);
    assert.equal(result.overallConversion, 1);
    assert.equal(result.steps[0].users, 2);
    assert.equal(result.steps[1].users, 2);
    assert.equal(result.steps[2].users, 2);
    assert.equal(result.steps[1].conversionFromPrev, 1);
    assert.equal(result.steps[2].conversionFromStart, 1);
});

test('computeFunnel only counts events that occur in the correct order', () => {
    // u1 added to cart BEFORE viewing — should not advance past step 0.
    const events: FunnelEvent[] = [
        ev('u1', 'add_to_cart', 1),
        ev('u1', 'view', 2),
        ev('u2', 'view', 1),
        ev('u2', 'add_to_cart', 2),
        ev('u2', 'checkout', 3),
    ];
    const result = computeFunnel(events, ['view', 'add_to_cart', 'checkout']);
    assert.equal(result.totalEntered, 2);
    assert.equal(result.steps[1].users, 1);
    assert.equal(result.steps[2].users, 1);
    assert.equal(result.totalCompleted, 1);
    assert.equal(result.overallConversion, 0.5);
    assert.equal(result.steps[1].dropOff, 1);
});

test('computeFunnel respects windowMs and drops users who took too long', () => {
    const events: FunnelEvent[] = [
        ev('u1', 'view', 0),
        ev('u1', 'add_to_cart', 5),
        ev('u1', 'checkout', 10),
        // u2 takes 1000ms between view and checkout — outside the window.
        ev('u2', 'view', 0),
        ev('u2', 'add_to_cart', 5),
        ev('u2', 'checkout', 1000),
    ];
    const result = computeFunnel(
        events,
        ['view', 'add_to_cart', 'checkout'],
        { windowMs: 100 },
    );
    assert.equal(result.totalEntered, 2);
    assert.equal(result.steps[1].users, 2); // both got to step 1 inside the window
    assert.equal(result.steps[2].users, 1); // only u1 finished in time
    assert.equal(result.totalCompleted, 1);
});

test('computeFunnel ignores malformed events and unknown step names', () => {
    const events: FunnelEvent[] = [
        ev('u1', 'view', 1),
        ev('u1', 'irrelevant', 2),
        ev('u1', 'add_to_cart', 3),
        // missing userId — should be ignored
        // @ts-expect-error intentional bad shape
        { name: 'view', ts: 1 },
    ];
    const result = computeFunnel(events, ['view', 'add_to_cart']);
    assert.equal(result.totalEntered, 1);
    assert.equal(result.totalCompleted, 1);
    assert.equal(result.overallConversion, 1);
    assert.equal(result.steps[0].conversionFromStart, 1);
});
