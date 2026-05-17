/**
 * Unit tests for `src/lib/reports/engine.ts` (CRM_REBUILD_PLAN §6.8).
 *
 *   npx tsx --test src/lib/reports/__tests__/engine.test.ts
 *
 * Stubs the Mongo accessor (`__setDbAccessor`) with an in-memory fake so
 * each handler is exercised against deterministic fixtures. No external
 * services are touched — the suite runs in <100 ms on CI.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ObjectId } from 'mongodb';

import { runReport, __setDbAccessor } from '../engine';
import type { ReportDefinition } from '../types';

/* ─── Fake Mongo ─────────────────────────────────────────────────────── */

interface FakeCollection {
    name: string;
    docs: any[];
}

function makeDb(collections: Record<string, any[]>) {
    const restore = __setDbAccessor(async () => ({
        db: {
            collection: (name: string) => ({
                find: (filter: any) => ({
                    toArray: async () => filterDocs(collections[name] ?? [], filter),
                }),
            }),
        } as any,
    }));
    return restore;
}

function filterDocs(docs: any[], filter: any): any[] {
    if (!filter || typeof filter !== 'object') return docs;
    return docs.filter((d) => {
        for (const [k, v] of Object.entries(filter)) {
            const actual = d[k];
            if (v && typeof v === 'object' && !(v instanceof ObjectId) && !(v instanceof Date)) {
                if ('$in' in (v as any)) {
                    const arr = (v as any).$in as any[];
                    if (!arr.some((x) => sameValue(actual, x))) return false;
                    continue;
                }
                if ('$gte' in (v as any) || '$lt' in (v as any) || '$lte' in (v as any)) {
                    const av = actual instanceof Date ? actual.getTime() : Number(actual);
                    if ('$gte' in (v as any)) {
                        const t = (v as any).$gte;
                        const tv = t instanceof Date ? t.getTime() : Number(t);
                        if (!(av >= tv)) return false;
                    }
                    if ('$lt' in (v as any)) {
                        const t = (v as any).$lt;
                        const tv = t instanceof Date ? t.getTime() : Number(t);
                        if (!(av < tv)) return false;
                    }
                    if ('$lte' in (v as any)) {
                        const t = (v as any).$lte;
                        const tv = t instanceof Date ? t.getTime() : Number(t);
                        if (!(av <= tv)) return false;
                    }
                    continue;
                }
            }
            if (!sameValue(actual, v)) return false;
        }
        return true;
    });
}

function sameValue(a: any, b: any): boolean {
    if (a instanceof ObjectId && b instanceof ObjectId) return a.equals(b);
    if (a instanceof ObjectId) return a.toString() === String(b);
    if (b instanceof ObjectId) return String(a) === b.toString();
    return a === b;
}

/* ─── Fixtures ───────────────────────────────────────────────────────── */

const TENANT = new ObjectId();
const ASOF = new Date('2026-05-18T12:00:00Z');

function mkDef(kind: any): ReportDefinition {
    return {
        userId: TENANT.toString(),
        kind,
        name: `test-${kind}`,
    };
}

/* ─── sales_summary ──────────────────────────────────────────────────── */

test('sales_summary returns 12 monthly rows with revenue totals', async () => {
    const restore = makeDb({
        crm_invoices: [
            {
                _id: new ObjectId(),
                userId: TENANT,
                invoiceDate: new Date('2026-05-10T00:00:00Z'),
                total: 1000,
                paidAmount: 800,
            },
            {
                _id: new ObjectId(),
                userId: TENANT,
                invoiceDate: new Date('2026-05-20T00:00:00Z'),
                total: 500,
                paidAmount: 500,
            },
            {
                _id: new ObjectId(),
                userId: TENANT,
                invoiceDate: new Date('2026-04-15T00:00:00Z'),
                total: 2000,
                paidAmount: 0,
            },
            // Outside the 12-month window — must be excluded.
            {
                _id: new ObjectId(),
                userId: TENANT,
                invoiceDate: new Date('2024-01-01T00:00:00Z'),
                total: 9999,
                paidAmount: 9999,
            },
        ],
    });
    try {
        const result = await runReport(mkDef('sales_summary'), {
            tenantUserId: TENANT.toString(),
            asOf: ASOF,
        });
        assert.equal(result.error, undefined, `unexpected error: ${result.error}`);
        assert.deepEqual(result.columns, [
            'month',
            'invoices_count',
            'gross',
            'paid',
            'outstanding',
        ]);
        assert.equal(result.rows.length, 12, '12 monthly rows');

        const may = result.rows.find((r) => r[0] === '2026-05');
        assert.ok(may, 'May 2026 row present');
        assert.equal(may![1], 2, 'May has 2 invoices');
        assert.equal(may![2], 1500, 'May gross = 1500');
        assert.equal(may![3], 1300, 'May paid = 1300');
        assert.equal(may![4], 200, 'May outstanding = 200');

        const apr = result.rows.find((r) => r[0] === '2026-04');
        assert.equal(apr![4], 2000, 'April fully outstanding');

        // Summary excludes the out-of-window doc (April 2024) — 3 in
        // the 12-month window.
        assert.equal(result.summary?.invoices_count, 3);
    } finally {
        restore();
    }
});

/* ─── lead_funnel ────────────────────────────────────────────────────── */

test('lead_funnel buckets stages and computes conversion%', async () => {
    const restore = makeDb({
        crm_deals: [
            { userId: TENANT, stage: 'New' },
            { userId: TENANT, stage: 'New' },
            { userId: TENANT, stage: 'Qualified' },
            { userId: TENANT, stage: 'Contacted' },
            { userId: TENANT, stage: 'Proposal Sent' },
            { userId: TENANT, stage: 'Won' },
            { userId: TENANT, stage: 'Won' },
            { userId: TENANT, stage: 'Lost' },
            // Unknown stage should be ignored.
            { userId: TENANT, stage: 'Archived' },
        ],
    });
    try {
        const result = await runReport(mkDef('lead_funnel'), {
            tenantUserId: TENANT.toString(),
            asOf: ASOF,
        });
        assert.equal(result.error, undefined);
        assert.deepEqual(result.columns, ['status', 'count', 'conversion_pct']);

        const byStatus = Object.fromEntries(
            result.rows.map((r) => [r[0], { count: r[1], pct: r[2] }]),
        );
        assert.equal(byStatus.new.count, 2);
        assert.equal(byStatus.qualified.count, 1);
        assert.equal(byStatus.contacted.count, 1);
        assert.equal(byStatus.proposal.count, 1);
        assert.equal(byStatus.won.count, 2);
        assert.equal(byStatus.lost.count, 1);

        // win_rate = won / (won + lost) = 2 / 3 ≈ 66.67
        assert.equal(result.summary?.win_rate_pct, 66.67);
        assert.equal(result.summary?.total_leads, 8);
    } finally {
        restore();
    }
});

/* ─── task_completion ────────────────────────────────────────────────── */

test('task_completion buckets by assignee × status and flags overdue', async () => {
    const ALICE = new ObjectId();
    const BOB = new ObjectId();
    const restore = makeDb({
        crm_tasks: [
            {
                userId: TENANT,
                assignedTo: ALICE,
                status: 'To-Do',
                dueDate: new Date('2026-04-01T00:00:00Z'), // overdue (before ASOF)
            },
            {
                userId: TENANT,
                assignedTo: ALICE,
                status: 'In Progress',
                dueDate: new Date('2026-06-01T00:00:00Z'),
            },
            {
                userId: TENANT,
                assignedTo: ALICE,
                status: 'Completed',
                dueDate: new Date('2026-04-01T00:00:00Z'),
            },
            {
                userId: TENANT,
                assignedTo: BOB,
                status: 'To-Do',
                dueDate: new Date('2026-06-30T00:00:00Z'),
            },
        ],
    });
    try {
        const result = await runReport(mkDef('task_completion'), {
            tenantUserId: TENANT.toString(),
            asOf: ASOF,
        });
        assert.equal(result.error, undefined);
        assert.deepEqual(result.columns, [
            'assignee',
            'todo',
            'in_progress',
            'completed',
            'overdue',
        ]);
        const byAssignee = Object.fromEntries(
            result.rows.map((r) => [r[0], r]),
        );
        const aliceKey = ALICE.toString();
        const bobKey = BOB.toString();
        assert.deepEqual(byAssignee[aliceKey].slice(1), [1, 1, 1, 1]);
        assert.deepEqual(byAssignee[bobKey].slice(1), [1, 0, 0, 0]);
        assert.equal(result.summary?.overdue, 1);
        assert.equal(result.summary?.completed, 1);
    } finally {
        restore();
    }
});

/* ─── invoice_aging ──────────────────────────────────────────────────── */

test('invoice_aging buckets outstanding invoices by days overdue', async () => {
    const restore = makeDb({
        crm_invoices: [
            // 10 days overdue → 0-30 bucket. Outstanding: 1000 - 200 = 800.
            {
                userId: TENANT,
                status: 'Sent',
                dueDate: new Date(ASOF.getTime() - 10 * 86400_000),
                total: 1000,
                paidAmount: 200,
            },
            // 45 days overdue → 31-60 bucket. Outstanding 500.
            {
                userId: TENANT,
                status: 'Overdue',
                dueDate: new Date(ASOF.getTime() - 45 * 86400_000),
                total: 500,
                paidAmount: 0,
            },
            // 100 days overdue → 90+ bucket.
            {
                userId: TENANT,
                status: 'Partially Paid',
                dueDate: new Date(ASOF.getTime() - 100 * 86400_000),
                total: 2000,
                paidAmount: 500,
            },
            // Not overdue yet — excluded.
            {
                userId: TENANT,
                status: 'Sent',
                dueDate: new Date(ASOF.getTime() + 10 * 86400_000),
                total: 700,
                paidAmount: 0,
            },
            // Fully paid (status Sent stripe-anomaly) — excluded by outstanding<=0.
            {
                userId: TENANT,
                status: 'Sent',
                dueDate: new Date(ASOF.getTime() - 20 * 86400_000),
                total: 300,
                paidAmount: 300,
            },
        ],
    });
    try {
        const result = await runReport(mkDef('invoice_aging'), {
            tenantUserId: TENANT.toString(),
            asOf: ASOF,
        });
        assert.equal(result.error, undefined);
        assert.deepEqual(result.columns, ['bucket', 'count', 'total']);

        const byBucket = Object.fromEntries(result.rows.map((r) => [r[0], r]));
        assert.deepEqual(byBucket['0-30'].slice(1), [1, 800]);
        assert.deepEqual(byBucket['31-60'].slice(1), [1, 500]);
        assert.deepEqual(byBucket['61-90'].slice(1), [0, 0]);
        assert.deepEqual(byBucket['90+'].slice(1), [1, 1500]);

        assert.equal(result.summary?.outstanding_invoices, 3);
        assert.equal(result.summary?.outstanding_total, 2800);
    } finally {
        restore();
    }
});

/* ─── payroll_summary ────────────────────────────────────────────────── */

test('payroll_summary aggregates payroll runs by month', async () => {
    const restore = makeDb({
        crm_payroll_runs: [
            {
                userId: TENANT,
                period_month: 5,
                period_year: 2026,
                total_employees: 10,
                total_gross: 100000,
                total_deductions: 15000,
                total_net: 85000,
            },
            {
                userId: TENANT,
                period_month: 4,
                period_year: 2026,
                total_employees: 9,
                total_gross: 90000,
                total_deductions: 12000,
                total_net: 78000,
            },
            // Out-of-window — older than 12 months — should not appear
            // in the row set but still survives in the totals only
            // because we read the whole collection. The handler doesn't
            // include it in the row output (no matching key).
            {
                userId: TENANT,
                period_month: 1,
                period_year: 2020,
                total_employees: 1,
                total_gross: 1,
                total_deductions: 0,
                total_net: 1,
            },
        ],
    });
    try {
        const result = await runReport(mkDef('payroll_summary'), {
            tenantUserId: TENANT.toString(),
            asOf: ASOF,
        });
        assert.equal(result.error, undefined);
        assert.deepEqual(result.columns, [
            'month',
            'employees',
            'gross',
            'deductions',
            'net',
        ]);
        assert.equal(result.rows.length, 12);

        const may = result.rows.find((r) => r[0] === '2026-05');
        const apr = result.rows.find((r) => r[0] === '2026-04');
        assert.ok(may);
        assert.ok(apr);
        assert.deepEqual(may!.slice(1), [10, 100000, 15000, 85000]);
        assert.deepEqual(apr!.slice(1), [9, 90000, 12000, 78000]);

        // Summary totals only the 12-month window.
        assert.equal(result.summary?.employees, 19);
        assert.equal(result.summary?.gross, 190000);
    } finally {
        restore();
    }
});

/* ─── Unimplemented kind ─────────────────────────────────────────────── */

test('unimplemented kinds return handler_not_implemented (no throw)', async () => {
    const restore = makeDb({});
    try {
        // `top_clients` is still stubbed in the engine; use it as the
        // canonical "unimplemented kind" case. GSTR-1/2B/3B moved to
        // real handlers as part of §6.10.
        const result = await runReport(mkDef('top_clients'), {
            tenantUserId: TENANT.toString(),
            asOf: ASOF,
        });
        assert.equal(result.error, 'handler_not_implemented');
        assert.equal(result.kind, 'top_clients');
        assert.deepEqual(result.rows, []);
    } finally {
        restore();
    }
});
