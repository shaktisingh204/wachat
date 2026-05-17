/**
 * Unit tests for the per-tenant audit-log retention helpers in
 * `src/lib/compliance/retention.ts`.  Runs with Node's built-in
 * `node:test` + `tsx`:
 *
 *   npx tsx --test src/lib/compliance/__tests__/audit-retention.test.ts
 *
 * The pure helpers (`resolveRetentionDaysFromTenantDoc`,
 * `clampRetentionDays`) are exercised directly. For
 * `getRetentionDaysForTenant` and `purgeAuditLogForTenant` we swap in
 * an in-memory `db` via `__setDbForTests` so the suite never opens a
 * real Mongo connection.
 */

import { strict as assert } from 'node:assert';
import { test, afterEach } from 'node:test';
import { ObjectId } from 'mongodb';

import {
    DEFAULT_AUDIT_RETENTION_DAYS,
    getRetentionDaysForTenant,
    purgeAuditLogForTenant,
    resolveRetentionDaysFromTenantDoc,
    __setDbForTests,
    __internals,
} from '../retention';

const {
    clampRetentionDays,
    MIN_AUDIT_RETENTION_DAYS,
    MAX_AUDIT_RETENTION_DAYS,
} = __internals;

afterEach(() => __setDbForTests(null));

/* ── Pure helpers ───────────────────────────────────────────────────── */

test('resolveRetentionDaysFromTenantDoc returns default when override missing', () => {
    assert.equal(
        resolveRetentionDaysFromTenantDoc(undefined),
        DEFAULT_AUDIT_RETENTION_DAYS,
    );
    assert.equal(
        resolveRetentionDaysFromTenantDoc(null),
        DEFAULT_AUDIT_RETENTION_DAYS,
    );
    assert.equal(resolveRetentionDaysFromTenantDoc({}), DEFAULT_AUDIT_RETENTION_DAYS);
    assert.equal(
        resolveRetentionDaysFromTenantDoc({ crm: {} }),
        DEFAULT_AUDIT_RETENTION_DAYS,
    );
    assert.equal(
        resolveRetentionDaysFromTenantDoc({ crm: { compliance: {} } }),
        DEFAULT_AUDIT_RETENTION_DAYS,
    );
});

test('resolveRetentionDaysFromTenantDoc honors the tenant override', () => {
    const doc = { crm: { compliance: { auditRetentionDays: 365 } } };
    assert.equal(resolveRetentionDaysFromTenantDoc(doc), 365);
});

test('resolveRetentionDaysFromTenantDoc clamps insane values', () => {
    assert.equal(
        resolveRetentionDaysFromTenantDoc({
            crm: { compliance: { auditRetentionDays: 1 } },
        }),
        MIN_AUDIT_RETENTION_DAYS,
    );
    assert.equal(
        resolveRetentionDaysFromTenantDoc({
            crm: { compliance: { auditRetentionDays: 99999 } },
        }),
        MAX_AUDIT_RETENTION_DAYS,
    );
});

test('resolveRetentionDaysFromTenantDoc rejects non-numeric overrides', () => {
    const doc = {
        crm: { compliance: { auditRetentionDays: '365' as unknown as number } },
    };
    assert.equal(resolveRetentionDaysFromTenantDoc(doc), DEFAULT_AUDIT_RETENTION_DAYS);
});

test('respects a caller-supplied fallback', () => {
    assert.equal(resolveRetentionDaysFromTenantDoc({}, 42), 42);
});

test('clampRetentionDays handles non-finite values', () => {
    assert.equal(clampRetentionDays(Number.NaN), DEFAULT_AUDIT_RETENTION_DAYS);
    assert.equal(clampRetentionDays(Number.POSITIVE_INFINITY), MAX_AUDIT_RETENTION_DAYS);
});

/* ── DB-backed helpers (in-memory fake) ─────────────────────────────── */

/**
 * Build a fake Mongo `db` shaped enough for `getRetentionDaysForTenant`
 * and `purgeAuditLogForTenant` to run. Exposes spy state for assertions.
 */
function makeFakeDb(opts: {
    userDoc?: Record<string, unknown> | null;
    matchingAuditRows?: number;
}) {
    const calls = {
        countDocuments: [] as Array<{ collection: string; filter: unknown }>,
        deleteMany: [] as Array<{ collection: string; filter: unknown }>,
        findOne: [] as Array<{ collection: string; filter: unknown }>,
    };

    const makeCollection = (name: string) => ({
        findOne: async (filter: unknown) => {
            calls.findOne.push({ collection: name, filter });
            if (name === 'users') return opts.userDoc ?? null;
            return null;
        },
        countDocuments: async (filter: unknown) => {
            calls.countDocuments.push({ collection: name, filter });
            return opts.matchingAuditRows ?? 0;
        },
        deleteMany: async (filter: unknown) => {
            calls.deleteMany.push({ collection: name, filter });
            return { deletedCount: opts.matchingAuditRows ?? 0 };
        },
    });

    return {
        db: { collection: (name: string) => makeCollection(name) },
        calls,
    };
}

test('getRetentionDaysForTenant returns the default when tenant has no override', async () => {
    const { db, calls } = makeFakeDb({ userDoc: { crm: {} } });
    __setDbForTests(db);

    const days = await getRetentionDaysForTenant(new ObjectId().toHexString());
    assert.equal(days, DEFAULT_AUDIT_RETENTION_DAYS);
    assert.equal(calls.findOne.length, 1);
    assert.equal(calls.findOne[0].collection, 'users');
});

test('getRetentionDaysForTenant returns the tenant override when set', async () => {
    const { db } = makeFakeDb({
        userDoc: { crm: { compliance: { auditRetentionDays: 180 } } },
    });
    __setDbForTests(db);

    const days = await getRetentionDaysForTenant(new ObjectId().toHexString());
    assert.equal(days, 180);
});

test('getRetentionDaysForTenant short-circuits on invalid ObjectId', async () => {
    // No fake — function should bail before touching the db.
    const days = await getRetentionDaysForTenant('not-an-objectid');
    assert.equal(days, DEFAULT_AUDIT_RETENTION_DAYS);
});

test('purgeAuditLogForTenant in dry-run mode counts but never deletes', async () => {
    const { db, calls } = makeFakeDb({ matchingAuditRows: 17 });
    __setDbForTests(db);

    const tenantId = new ObjectId().toHexString();
    const now = new Date('2026-05-17T00:00:00.000Z');
    const result = await purgeAuditLogForTenant(tenantId, {
        dryRun: true,
        retentionDays: 30,
        now,
    });

    assert.equal(result.dryRun, true);
    assert.equal(result.retentionDays, 30);
    assert.equal(result.wouldDelete, 17);
    assert.equal(result.deleted, 0);
    assert.equal(result.tenantUserId, tenantId);
    assert.equal(
        result.cutoff,
        new Date(now.getTime() - 30 * 86_400_000).toISOString(),
    );
    assert.equal(calls.countDocuments.length, 1);
    assert.equal(calls.countDocuments[0].collection, 'crm_audit_log');
    assert.equal(calls.deleteMany.length, 0);
});

test('purgeAuditLogForTenant defaults dryRun=true when caller omits options', async () => {
    const { db, calls } = makeFakeDb({ matchingAuditRows: 5 });
    __setDbForTests(db);

    const result = await purgeAuditLogForTenant(new ObjectId().toHexString(), {
        retentionDays: 90,
    });
    assert.equal(result.dryRun, true);
    assert.equal(result.deleted, 0);
    assert.equal(calls.deleteMany.length, 0);
});

test('purgeAuditLogForTenant in execute mode performs the deletion', async () => {
    const { db, calls } = makeFakeDb({ matchingAuditRows: 4 });
    __setDbForTests(db);

    const result = await purgeAuditLogForTenant(new ObjectId().toHexString(), {
        dryRun: false,
        retentionDays: 60,
    });

    assert.equal(result.dryRun, false);
    assert.equal(result.deleted, 4);
    assert.equal(result.wouldDelete, 4);
    assert.equal(calls.deleteMany.length, 1);
    assert.equal(calls.deleteMany[0].collection, 'crm_audit_log');
});

test('purgeAuditLogForTenant short-circuits on invalid tenant id', async () => {
    // No fake — function should bail before touching the db.
    const result = await purgeAuditLogForTenant('not-a-real-id', { dryRun: false });
    assert.equal(result.wouldDelete, 0);
    assert.equal(result.deleted, 0);
});

test('purgeAuditLogForTenant falls back to per-tenant retention lookup when no retentionDays arg', async () => {
    // Same fake serves both the `users` lookup (returns override = 45) and
    // the audit-log count (returns 3 rows).
    const { db } = makeFakeDb({
        userDoc: { crm: { compliance: { auditRetentionDays: 45 } } },
        matchingAuditRows: 3,
    });
    __setDbForTests(db);

    const result = await purgeAuditLogForTenant(new ObjectId().toHexString(), {
        // dryRun left undefined → defaults to true.
    });
    assert.equal(result.retentionDays, 45);
    assert.equal(result.wouldDelete, 3);
    assert.equal(result.deleted, 0);
    assert.equal(result.dryRun, true);
});
