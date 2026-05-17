/**
 * Pure unit tests for `normalizeAuditDiff` in `audit-log.ts`. The helper
 * is the single source of truth for the JSON shape persisted into
 * `crm_audit_log` / `audit_events` `before` / `after` payloads.
 *
 *   npx tsx --test src/lib/compliance/__tests__/audit-diff-normalize.test.ts
 *
 * No Mongo connection required — `normalizeAuditDiff` is pure.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ObjectId } from 'mongodb';

import { normalizeAuditDiff, canonicalize } from '../audit-log';

/* ── ObjectId ──────────────────────────────────────────────────────── */

test('ObjectId is collapsed to its hex string', () => {
    const oid = new ObjectId('507f1f77bcf86cd799439011');
    const out = normalizeAuditDiff({ id: oid });
    assert.deepEqual(out, { id: '507f1f77bcf86cd799439011' });
});

test('ObjectId-like duck (toHexString only) is also collapsed', () => {
    const fake = {
        toHexString() {
            return 'deadbeefdeadbeefdeadbeef';
        },
    };
    const out = normalizeAuditDiff({ id: fake });
    assert.deepEqual(out, { id: 'deadbeefdeadbeefdeadbeef' });
});

test('nested ObjectId inside arrays is collapsed', () => {
    const ids = [
        new ObjectId('507f1f77bcf86cd799439011'),
        new ObjectId('507f1f77bcf86cd799439012'),
    ];
    const out = normalizeAuditDiff({ assignees: ids });
    assert.deepEqual(out, {
        assignees: [
            '507f1f77bcf86cd799439011',
            '507f1f77bcf86cd799439012',
        ],
    });
});

/* ── Date ──────────────────────────────────────────────────────────── */

test('Date instance becomes an ISO-8601 string', () => {
    const d = new Date('2026-05-17T12:34:56.789Z');
    const out = normalizeAuditDiff({ when: d });
    assert.deepEqual(out, { when: '2026-05-17T12:34:56.789Z' });
});

test('invalid Date is coerced to null (JSON-safe)', () => {
    const out = normalizeAuditDiff({ when: new Date('not-a-date') });
    assert.deepEqual(out, { when: null });
});

/* ── undefined drop ────────────────────────────────────────────────── */

test('undefined object values are dropped', () => {
    const out = normalizeAuditDiff({
        kept: 'yes',
        gone: undefined,
        also: null,
    });
    assert.deepEqual(out, { also: null, kept: 'yes' });
    assert.equal(
        Object.prototype.hasOwnProperty.call(out as object, 'gone'),
        false,
    );
});

test('undefined array elements survive as null (order preserved)', () => {
    const out = normalizeAuditDiff(['a', undefined, 'c']);
    assert.deepEqual(out, ['a', null, 'c']);
});

/* ── Nested sort ───────────────────────────────────────────────────── */

test('object keys are sorted alphabetically at every level', () => {
    const out = normalizeAuditDiff({
        zeta: 1,
        alpha: { y: 2, x: 1, m: { c: 3, a: 1, b: 2 } },
        mike: [
            { delta: 1, beta: 2 },
            { zulu: 9, alpha: 0 },
        ],
    });
    const json = JSON.stringify(out);
    assert.equal(
        json,
        '{"alpha":{"m":{"a":1,"b":2,"c":3},"x":1,"y":2},"mike":[{"beta":2,"delta":1},{"alpha":0,"zulu":9}],"zeta":1}',
    );
});

test('two equivalent inputs with different key orders normalize identically', () => {
    const a = normalizeAuditDiff({ b: 2, a: 1, c: { y: 1, x: 2 } });
    const b = normalizeAuditDiff({ a: 1, c: { x: 2, y: 1 }, b: 2 });
    assert.equal(canonicalize(a), canonicalize(b));
    assert.equal(JSON.stringify(a), JSON.stringify(b));
});

/* ── Array preservation ────────────────────────────────────────────── */

test('arrays preserve original item order (semantic)', () => {
    const out = normalizeAuditDiff({ steps: ['c', 'a', 'b'] });
    assert.deepEqual(out, { steps: ['c', 'a', 'b'] });
});

test('array of objects: items keep order, keys inside sort', () => {
    const out = normalizeAuditDiff([
        { z: 1, a: 2 },
        { y: 3, b: 4 },
    ]);
    // Outer items keep order; inner keys are sorted.
    assert.equal(
        JSON.stringify(out),
        '[{"a":2,"z":1},{"b":4,"y":3}]',
    );
});

/* ── BigInt ────────────────────────────────────────────────────────── */

test('BigInt is converted to its decimal string', () => {
    const out = normalizeAuditDiff({
        amount: 9_007_199_254_740_993n,
        nested: { big: 42n },
    });
    assert.deepEqual(out, {
        amount: '9007199254740993',
        nested: { big: '42' },
    });
});

/* ── Smoke: round-trip stability ───────────────────────────────────── */

test('output is JSON-safe (round-trips via JSON.stringify / parse)', () => {
    const input = {
        id: new ObjectId('507f1f77bcf86cd799439011'),
        when: new Date('2026-01-01T00:00:00.000Z'),
        big: 12345678901234567890n,
        skip: undefined,
        nested: { z: [1, 2, { b: 2, a: 1 }], a: 'x' },
    };
    const normalized = normalizeAuditDiff(input);
    const roundtripped = JSON.parse(JSON.stringify(normalized));
    assert.deepEqual(roundtripped, normalized);
});

test('non-finite numbers (NaN / Infinity) become null', () => {
    const out = normalizeAuditDiff({
        nan: Number.NaN,
        inf: Number.POSITIVE_INFINITY,
        neg: Number.NEGATIVE_INFINITY,
        ok: 3.14,
    });
    assert.deepEqual(out, { inf: null, nan: null, neg: null, ok: 3.14 });
});
