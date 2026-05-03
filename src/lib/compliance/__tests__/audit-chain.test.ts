/**
 * Pure unit tests for the hash-chain helpers in `audit-log.ts`.
 *
 *   npx tsx --test src/lib/compliance/__tests__/audit-chain.test.ts
 *
 * We do not need a Mongo connection — `verifyChain`, `hashEvent` and
 * `canonicalize` are all pure functions.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
    canonicalize,
    hashEvent,
    verifyChain,
    __internals,
} from '../audit-log';
import type { AuditEvent } from '../types';

const GENESIS = __internals.GENESIS_HASH;

function makeEntry(
    overrides: Partial<AuditEvent> & { id: string; ts: string; tenantId: string },
    prev_hash: string,
): AuditEvent {
    const payload: Omit<AuditEvent, 'hash' | 'prev_hash'> = {
        id: overrides.id,
        ts: overrides.ts,
        tenantId: overrides.tenantId,
        actor: overrides.actor ?? 'user:1',
        action: overrides.action ?? 'noop',
        resource: overrides.resource ?? 'thing/1',
        before: overrides.before,
        after: overrides.after,
        metadata: overrides.metadata,
    };
    return {
        ...payload,
        prev_hash,
        hash: hashEvent(prev_hash, payload),
    };
}

function makeChain(n: number): AuditEvent[] {
    const events: AuditEvent[] = [];
    let prev = GENESIS;
    for (let i = 0; i < n; i++) {
        const e = makeEntry(
            {
                id: `evt-${i}`,
                ts: new Date(1_700_000_000_000 + i * 1000).toISOString(),
                tenantId: 't1',
                action: 'contact.update',
                resource: `contacts/${i}`,
                after: { name: `n${i}` },
            },
            prev,
        );
        events.push(e);
        prev = e.hash;
    }
    return events;
}

test('verifyChain returns -1 for an intact chain', () => {
    const chain = makeChain(5);
    assert.equal(verifyChain(chain), -1);
});

test('empty chain is trivially intact', () => {
    assert.equal(verifyChain([]), -1);
});

test('mutating an entry payload breaks the chain at that index', () => {
    const chain = makeChain(4);
    // Tamper with entry 2's `after` payload.
    chain[2] = {
        ...chain[2],
        after: { name: 'TAMPERED' },
    };
    const idx = verifyChain(chain);
    assert.equal(idx, 2, 'tamper should be detected at index 2');
});

test('mutating prev_hash breaks the chain', () => {
    const chain = makeChain(3);
    chain[1] = {
        ...chain[1],
        prev_hash:
            'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    };
    assert.equal(verifyChain(chain), 1);
});

test('removing a middle entry breaks the chain at the next entry', () => {
    const chain = makeChain(4);
    const broken = [chain[0], chain[2], chain[3]];
    // Index 1 in the broken array is what *was* chain[2]; its
    // prev_hash points at chain[1] which is gone, so verification
    // must fail at index 1.
    assert.equal(verifyChain(broken), 1);
});

test('canonicalize produces stable output regardless of key order', () => {
    const a = canonicalize({ b: 2, a: 1, c: { y: 1, x: 2 } });
    const b = canonicalize({ a: 1, c: { x: 2, y: 1 }, b: 2 });
    assert.equal(a, b);
});

test('hashEvent is deterministic and depends on prev_hash', () => {
    const payload: Omit<AuditEvent, 'hash' | 'prev_hash'> = {
        id: 'x',
        ts: '2025-01-01T00:00:00.000Z',
        tenantId: 't',
        actor: 'u',
        action: 'a',
        resource: 'r',
    };
    const h1 = hashEvent(GENESIS, payload);
    const h2 = hashEvent(GENESIS, payload);
    const h3 = hashEvent('ff'.repeat(32), payload);
    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
    assert.match(h1, /^[0-9a-f]{64}$/);
});

test('replacing entry hash with random bytes is detected', () => {
    const chain = makeChain(3);
    chain[0] = {
        ...chain[0],
        hash: '00'.repeat(32),
    };
    assert.equal(verifyChain(chain), 0);
});
