/**
 * Unit tests for the pure automations evaluator. Run via:
 *
 *   npx tsx --test src/lib/automations/__tests__/evaluate.test.ts
 */

import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import { matchesTrigger, passesConditions } from '../evaluate';
import type {
    Automation,
    AutomationDomainEvent,
    AutomationEntitySnapshot,
} from '../types';

function makeAutomation(overrides: Partial<Automation> = {}): Automation {
    return {
        _id: 'auto-1',
        userId: 'tenant-1',
        name: 'Test automation',
        isEnabled: true,
        status: 'active',
        trigger: {
            type: 'entity_created',
            config: { entityKind: 'lead' },
        },
        conditions: [],
        actions: [],
        ...overrides,
    };
}

function makeEvent(
    overrides: Partial<AutomationDomainEvent> = {},
): AutomationDomainEvent {
    return {
        type: 'entity_created',
        entityKind: 'lead',
        entityId: 'lead-1',
        tenantUserId: 'tenant-1',
        entity: { _id: 'lead-1', userId: 'tenant-1', source: 'website' },
        occurredAt: 1_700_000_000_000,
        ...overrides,
    };
}

/* ------------------------------ TRIGGERS ------------------------------ */

test('matchesTrigger: entity_created fires when entity matches', () => {
    const a = makeAutomation();
    const e = makeEvent();
    assert.equal(matchesTrigger(a, e), true);
});

test('matchesTrigger: entity_created does not fire for wrong entityKind', () => {
    const a = makeAutomation({
        trigger: { type: 'entity_created', config: { entityKind: 'deal' } },
    });
    const e = makeEvent(); // entityKind = lead
    assert.equal(matchesTrigger(a, e), false);
});

test('matchesTrigger: entity_updated with fieldName filter', () => {
    const a = makeAutomation({
        trigger: {
            type: 'entity_updated',
            config: { entityKind: 'lead', fieldName: 'status' },
        },
    });
    assert.equal(
        matchesTrigger(
            a,
            makeEvent({ type: 'entity_updated', fieldName: 'status' }),
        ),
        true,
    );
    assert.equal(
        matchesTrigger(
            a,
            makeEvent({ type: 'entity_updated', fieldName: 'title' }),
        ),
        false,
    );
});

test('matchesTrigger: status_changed matches from/to values', () => {
    const a = makeAutomation({
        trigger: {
            type: 'status_changed',
            config: {
                entityKind: 'lead',
                fieldName: 'status',
                fromValue: 'new',
                toValue: 'qualified',
            },
        },
    });
    const hit = makeEvent({
        type: 'status_changed',
        fieldName: 'status',
        fromValue: 'new',
        toValue: 'qualified',
    });
    const miss = makeEvent({
        type: 'status_changed',
        fieldName: 'status',
        fromValue: 'new',
        toValue: 'lost',
    });
    assert.equal(matchesTrigger(a, hit), true);
    assert.equal(matchesTrigger(a, miss), false);
});

test('matchesTrigger: time_elapsed honours minimum threshold', () => {
    const a = makeAutomation({
        trigger: {
            type: 'time_elapsed',
            config: { entityKind: 'lead', elapsedMinutes: 60 },
        },
    });
    assert.equal(
        matchesTrigger(
            a,
            makeEvent({ type: 'time_elapsed', elapsedMinutes: 30 }),
        ),
        false,
    );
    assert.equal(
        matchesTrigger(
            a,
            makeEvent({ type: 'time_elapsed', elapsedMinutes: 90 }),
        ),
        true,
    );
});

/* ----------------------------- CONDITIONS ---------------------------- */

test('passesConditions: field_equals passes/fails as expected', () => {
    const a = makeAutomation({
        conditions: [
            { kind: 'field_equals', field: 'source', value: 'website' },
        ],
    });
    const entityHit: AutomationEntitySnapshot = { source: 'website' };
    const entityMiss: AutomationEntitySnapshot = { source: 'referral' };
    assert.equal(passesConditions(a, entityHit), true);
    assert.equal(passesConditions(a, entityMiss), false);
});

test('passesConditions: field_in matches any of a value list', () => {
    const a = makeAutomation({
        conditions: [
            {
                kind: 'field_in',
                field: 'status',
                value: ['new', 'qualified'],
            },
        ],
    });
    assert.equal(passesConditions(a, { status: 'new' }), true);
    assert.equal(passesConditions(a, { status: 'qualified' }), true);
    assert.equal(passesConditions(a, { status: 'lost' }), false);
});

test('passesConditions: has_tag accepts both string[] and {name}[]', () => {
    const a = makeAutomation({
        conditions: [{ kind: 'has_tag', field: 'tags', value: 'vip' }],
    });
    assert.equal(passesConditions(a, { tags: ['vip', 'returning'] }), true);
    assert.equal(
        passesConditions(a, {
            tags: [{ name: 'vip' }, { name: 'returning' }],
        }),
        true,
    );
    assert.equal(passesConditions(a, { tags: ['returning'] }), false);
});

test('passesConditions: in_stage falls back to entity.stage/status', () => {
    const a = makeAutomation({
        conditions: [{ kind: 'in_stage', value: 'qualified' }],
    });
    assert.equal(passesConditions(a, { stage: 'qualified' }), true);
    assert.equal(passesConditions(a, { status: 'qualified' }), true);
    assert.equal(passesConditions(a, { status: 'new' }), false);
});

test('passesConditions: empty conditions array always passes', () => {
    const a = makeAutomation({ conditions: [] });
    assert.equal(passesConditions(a, { anything: 1 }), true);
});

test('passesConditions: AND semantics — all conditions must pass', () => {
    const a = makeAutomation({
        conditions: [
            { kind: 'field_equals', field: 'source', value: 'website' },
            { kind: 'in_stage', value: 'qualified' },
        ],
    });
    assert.equal(
        passesConditions(a, { source: 'website', stage: 'qualified' }),
        true,
    );
    assert.equal(
        passesConditions(a, { source: 'website', stage: 'new' }),
        false,
    );
    assert.equal(
        passesConditions(a, { source: 'referral', stage: 'qualified' }),
        false,
    );
});
