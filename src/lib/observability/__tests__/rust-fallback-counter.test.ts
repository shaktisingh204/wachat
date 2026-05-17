/**
 * Unit tests for `recordRustFallback` emit shape.
 *
 * The §1B sign-off requires a flat structured JSON line on stdout so a
 * Vercel Log Drain + log-search rule keyed on `event:"rust_fallback"` can
 * fire alerts. These tests assert the shape so a future refactor can't
 * silently break the contract.
 *
 *   pnpm exec tsx --test src/lib/observability/__tests__/rust-fallback-counter.test.ts
 */

import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { test, before, beforeEach } from 'node:test';

// The SUT imports `server-only`, a marker package that intentionally has no
// installable entry outside the Next.js compile pipeline. tsx compiles the
// SUT to CJS, so we intercept the CJS resolver to alias `server-only` to a
// no-op module before dynamic-importing the SUT. No new npm deps.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Module = require('node:module') as {
    _resolveFilename: (req: string, parent: unknown, ...rest: unknown[]) => string;
    _cache: Record<string, { id: string; filename: string; loaded: boolean; exports: unknown }>;
};
const STUB_ID = '\0server-only-stub';
Module._cache[STUB_ID] = {
    id: STUB_ID,
    filename: STUB_ID,
    loaded: true,
    exports: {},
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function patched(req: string, parent: unknown, ...rest: unknown[]) {
    if (req === 'server-only') return STUB_ID;
    return originalResolve.call(this, req, parent, ...rest);
};

// Dynamic import — must run AFTER the resolver patch is in effect.
type SUT = typeof import('../rust-fallback-counter');
let mod: SUT;

before(async () => {
    mod = await import('../rust-fallback-counter');
});

// Hijack console.log per test to capture emitted lines.
let captured: string[] = [];
const realLog = console.log;

beforeEach(() => {
    captured = [];
    console.log = (line: unknown) => {
        captured.push(typeof line === 'string' ? line : String(line));
    };
    mod._resetRustFallbackState();
});

test('recordRustFallback emits a single JSON line on stdout', () => {
    mod.recordRustFallback({ entity: 'loyalty_program', op: 'list' });
    console.log = realLog;

    assert.equal(captured.length, 1, 'expected exactly one console.log call');
    const parsed = JSON.parse(captured[0]!);
    assert.equal(parsed.event, 'rust_fallback');
    assert.equal(parsed.entity, 'loyalty_program');
    assert.equal(parsed.op, 'list');
    assert.equal(typeof parsed.ts, 'string');
    // ts must be ISO 8601 so Vercel log-search timestamp filters parse it.
    assert.ok(
        !Number.isNaN(Date.parse(parsed.ts)),
        `ts is not a valid ISO date: ${parsed.ts}`,
    );
});

test('recordRustFallback includes errorCode + status when provided', () => {
    mod.recordRustFallback({
        entity: 'invoice',
        op: 'create',
        errorCode: 'RUST_TIMEOUT',
        status: 504,
    });
    console.log = realLog;

    const parsed = JSON.parse(captured[0]!);
    assert.equal(parsed.errorCode, 'RUST_TIMEOUT');
    assert.equal(parsed.status, 504);
});

test('recordRustFallback omits optional fields when not provided', () => {
    mod.recordRustFallback({ entity: 'lead', op: 'get' });
    console.log = realLog;

    const parsed = JSON.parse(captured[0]!);
    assert.equal(
        Object.prototype.hasOwnProperty.call(parsed, 'errorCode'),
        false,
        'errorCode key must be absent (not emitted as undefined)',
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(parsed, 'status'),
        false,
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(parsed, 'tenantUserId'),
        false,
    );
});

test('recordRustFallback emits tenantUserId when provided', () => {
    mod.recordRustFallback({
        entity: 'invoice',
        op: 'update',
        tenantUserId: 'tenant_abc123',
    });
    console.log = realLog;

    const parsed = JSON.parse(captured[0]!);
    assert.equal(parsed.tenantUserId, 'tenant_abc123');
});

test('recordRustFallback payload is flat — no nested objects', () => {
    mod.recordRustFallback({
        entity: 'payment',
        op: 'delete',
        errorCode: 'CONFLICT',
        status: 409,
        tenantUserId: 'tenant_xyz',
    });
    console.log = realLog;

    const parsed = JSON.parse(captured[0]!);
    // The §1B contract requires a flat shape so log-search filters like
    // `event:"rust_fallback" entity:"loyalty_program"` match deterministically.
    for (const [key, value] of Object.entries(parsed)) {
        assert.ok(
            value === null
                || typeof value === 'string'
                || typeof value === 'number'
                || typeof value === 'boolean',
            `payload.${key} is not a scalar (got ${typeof value}) — the log line must stay flat`,
        );
    }
});

test('recordRustFallback never throws — even on weird input', () => {
    // The catch-block in recordRustFallback exists so telemetry can't take
    // down a CRM action. Make sure that guarantee holds.
    assert.doesNotThrow(() => {
        mod.recordRustFallback({
            entity: 'x',
            op: 'other',
            // Force JSON.stringify failure with a circular ref smuggled
            // through a cast — recordRustFallback should swallow it.
            errorCode: { toJSON() { throw new Error('boom'); } } as unknown as string,
        });
    });
    console.log = realLog;
});
