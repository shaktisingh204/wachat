/**
 * CRM Reports Engine — `CRM_REBUILD_PLAN.md` §6.8.
 *
 * One `runReport(definition, options)` entry point dispatches a saved
 * `ReportDefinition` to a per-kind handler. Each handler returns the
 * same tabular shape (`{ columns, rows, summary? }`) so the persistence
 * + delivery layers don't care which kind ran.
 *
 * # Foundation set (5 handlers implemented)
 *
 *   1. `sales_summary`   — revenue by month (last 12)
 *   2. `lead_funnel`     — leads by funnel stage with conversion %
 *   3. `task_completion` — tasks by assignee × status
 *   4. `invoice_aging`   — outstanding invoices by aging bucket
 *   5. `payroll_summary` — payroll by month (last 12)
 *
 * Every other `ReportKind` returns
 * `{ error: 'handler_not_implemented', kind }` so the engine never
 * throws on a known-but-unsupported kind. New handlers slot into the
 * dispatch table without touching callers.
 *
 * # Data access
 *
 * Each handler is a thin Mongo aggregation against the tenant's
 * primary collections (`crm_invoices`, `crm_deals`, `crm_tasks`,
 * `crm_payroll_runs`). The handler resolves the tenant id from
 * `options.tenantUserId` first, falling back to `definition.userId`.
 * Everything is read-only — the engine never mutates tenant data.
 *
 * # Determinism for tests
 *
 * The exported `__internal` namespace exposes the handlers + Mongo
 * accessor so unit tests can stub the DB without spinning up Mongo.
 * See `src/lib/reports/__tests__/engine.test.ts`.
 */

import { ObjectId, type Db } from 'mongodb';

import type {
    ReportDefinition,
    ReportKind,
    ReportRunOptions,
    ReportRunResult,
} from './types';
import { generateGstr1, projectGstr1ToReportResult } from './india/gstr1';
import { generateGstr3b, projectGstr3bToReportResult } from './india/gstr3b';
import { projectGstr2bToReportResult, type Gstr2bReturn } from './india/gstr2b';

/* ─── DB accessor (overridable for tests) ───────────────────────────── */

type DbAccessor = () => Promise<{ db: Db }>;

let dbAccessor: DbAccessor = async () => {
    const mod = await import('@/lib/mongodb');
    return mod.connectToDatabase();
};

/** Test hook — replace the DB accessor. Returns a restore fn. */
export function __setDbAccessor(fn: DbAccessor): () => void {
    const prev = dbAccessor;
    dbAccessor = fn;
    return () => {
        dbAccessor = prev;
    };
}

/* ─── Public entry point ─────────────────────────────────────────────── */

/**
 * Run a saved report definition through the engine. Never throws on a
 * known-but-unimplemented kind — returns
 * `{ error: 'handler_not_implemented', kind }` instead so callers can
 * surface the gap without a 500.
 */
export async function runReport(
    definition: ReportDefinition,
    options: ReportRunOptions = {},
): Promise<ReportRunResult> {
    const kind = definition.kind;
    const handler = HANDLERS[kind];
    if (!handler) {
        return {
            columns: [],
            rows: [],
            kind,
            error: 'handler_not_implemented',
        };
    }

    const tenantId = resolveTenantId(definition, options);
    if (!tenantId) {
        return {
            columns: [],
            rows: [],
            kind,
            error: 'tenant_user_id_missing',
        };
    }

    const asOf = options.asOf instanceof Date ? options.asOf : new Date();

    try {
        const ctx: HandlerContext = {
            db: (await dbAccessor()).db,
            tenantUserId: new ObjectId(tenantId),
            asOf,
            filters: definition.filters ?? {},
        };
        const out = await handler(ctx);
        return { ...out, kind };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
            columns: [],
            rows: [],
            kind,
            error: `handler_failed: ${msg}`,
        };
    }
}

function resolveTenantId(
    def: ReportDefinition,
    opts: ReportRunOptions,
): string | null {
    const candidate = opts.tenantUserId ?? def.userId;
    if (!candidate) return null;
    const s = typeof candidate === 'string' ? candidate : candidate.toString();
    return ObjectId.isValid(s) ? s : null;
}

/* ─── Handler protocol ───────────────────────────────────────────────── */

interface HandlerContext {
    db: Db;
    tenantUserId: ObjectId;
    asOf: Date;
    filters: NonNullable<ReportDefinition['filters']>;
}

type Handler = (ctx: HandlerContext) => Promise<ReportRunResult>;

/* ─── Time helpers ───────────────────────────────────────────────────── */

/**
 * Returns the last `n` months ending at `asOf` (inclusive), each as
 * a `{ key, start, end }` window. `key` is `YYYY-MM` for stable
 * row keys; `start`/`end` are UTC `Date` objects bounding the month.
 */
function lastNMonths(asOf: Date, n: number): Array<{ key: string; start: Date; end: Date }> {
    const out: Array<{ key: string; start: Date; end: Date }> = [];
    const cursor = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
    for (let i = n - 1; i >= 0; i--) {
        const start = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
        const month = String(start.getUTCMonth() + 1).padStart(2, '0');
        out.push({
            key: `${start.getUTCFullYear()}-${month}`,
            start,
            end,
        });
    }
    return out;
}

/* ─── Handler: sales_summary ─────────────────────────────────────────── */

const salesSummary: Handler = async (ctx) => {
    const months = lastNMonths(ctx.asOf, 12);
    const earliest = months[0].start;
    const latest = months[months.length - 1].end;

    const invoices = await ctx.db
        .collection('crm_invoices')
        .find({
            userId: ctx.tenantUserId,
            invoiceDate: { $gte: earliest, $lt: latest },
        })
        .toArray();

    const rows: unknown[][] = [];
    let totalGross = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    for (const m of months) {
        let count = 0;
        let gross = 0;
        let paid = 0;
        for (const inv of invoices as any[]) {
            const d = inv.invoiceDate instanceof Date ? inv.invoiceDate : new Date(inv.invoiceDate);
            if (d < m.start || d >= m.end) continue;
            count++;
            const total = Number(inv.total ?? 0) || 0;
            const paidAmount = Number(inv.paidAmount ?? 0) || 0;
            gross += total;
            paid += paidAmount;
        }
        const outstanding = Math.max(0, gross - paid);
        rows.push([m.key, count, round2(gross), round2(paid), round2(outstanding)]);
        totalGross += gross;
        totalPaid += paid;
        totalOutstanding += outstanding;
    }

    return {
        columns: ['month', 'invoices_count', 'gross', 'paid', 'outstanding'],
        rows,
        summary: {
            invoices_count: invoices.length,
            gross: round2(totalGross),
            paid: round2(totalPaid),
            outstanding: round2(totalOutstanding),
        },
    };
};

/* ─── Handler: lead_funnel ───────────────────────────────────────────── */

const FUNNEL_BUCKETS: Array<{ key: string; matchers: string[] }> = [
    { key: 'new', matchers: ['new', 'open', 'new_lead'] },
    { key: 'qualified', matchers: ['qualified'] },
    { key: 'contacted', matchers: ['contacted'] },
    { key: 'proposal', matchers: ['proposal', 'proposal sent', 'proposal_sent', 'negotiation'] },
    { key: 'won', matchers: ['won', 'deal done', 'closed_won', 'deal_done'] },
    { key: 'lost', matchers: ['lost', 'closed_lost'] },
];

function bucketForStage(raw: unknown): string | null {
    if (!raw) return null;
    const s = String(raw).trim().toLowerCase();
    for (const b of FUNNEL_BUCKETS) {
        if (b.matchers.includes(s)) return b.key;
    }
    return null;
}

const leadFunnel: Handler = async (ctx) => {
    const deals = await ctx.db
        .collection('crm_deals')
        .find({ userId: ctx.tenantUserId })
        .toArray();

    const counts: Record<string, number> = {};
    for (const b of FUNNEL_BUCKETS) counts[b.key] = 0;

    for (const d of deals as any[]) {
        const bucket = bucketForStage(d.stage ?? d.status ?? d.stageId);
        if (bucket) counts[bucket] = (counts[bucket] ?? 0) + 1;
    }

    const closedTotal = counts.won + counts.lost;
    const top = counts.new + counts.qualified + counts.contacted + counts.proposal + closedTotal;

    const rows: unknown[][] = FUNNEL_BUCKETS.map((b) => {
        const count = counts[b.key] ?? 0;
        const conversion =
            top > 0 ? round2((count / top) * 100) : 0;
        return [b.key, count, conversion];
    });

    return {
        columns: ['status', 'count', 'conversion_pct'],
        rows,
        summary: {
            total_leads: top,
            won: counts.won,
            lost: counts.lost,
            win_rate_pct: closedTotal > 0 ? round2((counts.won / closedTotal) * 100) : 0,
        },
    };
};

/* ─── Handler: task_completion ───────────────────────────────────────── */

const taskCompletion: Handler = async (ctx) => {
    const tasks = await ctx.db
        .collection('crm_tasks')
        .find({ userId: ctx.tenantUserId })
        .toArray();

    const now = ctx.asOf;
    const byAssignee = new Map<string, { todo: number; in_progress: number; completed: number; overdue: number }>();
    const ensure = (key: string) => {
        let row = byAssignee.get(key);
        if (!row) {
            row = { todo: 0, in_progress: 0, completed: 0, overdue: 0 };
            byAssignee.set(key, row);
        }
        return row;
    };

    for (const t of tasks as any[]) {
        const assignee = t.assignedTo ? String(t.assignedTo) : 'unassigned';
        const row = ensure(assignee);
        const status = String(t.status ?? '').toLowerCase().replace(/[\s-]+/g, '_');
        if (status === 'completed' || status === 'done') {
            row.completed++;
        } else if (status === 'in_progress' || status === 'inprogress') {
            row.in_progress++;
        } else {
            row.todo++;
        }
        if (status !== 'completed' && status !== 'done') {
            const due = t.dueDate ? new Date(t.dueDate) : null;
            if (due instanceof Date && !isNaN(due.getTime()) && due < now) {
                row.overdue++;
            }
        }
    }

    const rows: unknown[][] = [...byAssignee.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([assignee, r]) => [assignee, r.todo, r.in_progress, r.completed, r.overdue]);

    let totals = { todo: 0, in_progress: 0, completed: 0, overdue: 0 };
    for (const r of byAssignee.values()) {
        totals.todo += r.todo;
        totals.in_progress += r.in_progress;
        totals.completed += r.completed;
        totals.overdue += r.overdue;
    }

    return {
        columns: ['assignee', 'todo', 'in_progress', 'completed', 'overdue'],
        rows,
        summary: {
            total: tasks.length,
            completed: totals.completed,
            overdue: totals.overdue,
        },
    };
};

/* ─── Handler: invoice_aging ─────────────────────────────────────────── */

const AGING_BUCKETS: Array<{ key: string; min: number; max: number | null }> = [
    { key: '0-30', min: 0, max: 30 },
    { key: '31-60', min: 31, max: 60 },
    { key: '61-90', min: 61, max: 90 },
    { key: '90+', min: 91, max: null },
];

const invoiceAging: Handler = async (ctx) => {
    const invoices = await ctx.db
        .collection('crm_invoices')
        .find({
            userId: ctx.tenantUserId,
            status: { $in: ['Sent', 'Partially Paid', 'Overdue'] },
        })
        .toArray();

    const now = ctx.asOf;
    const counts: Record<string, { count: number; total: number }> = {};
    for (const b of AGING_BUCKETS) counts[b.key] = { count: 0, total: 0 };

    for (const inv of invoices as any[]) {
        const total = Number(inv.total ?? 0) || 0;
        const paid = Number(inv.paidAmount ?? 0) || 0;
        const outstanding = Math.max(0, total - paid);
        if (outstanding <= 0) continue;

        const due = inv.dueDate
            ? new Date(inv.dueDate)
            : inv.invoiceDate
              ? new Date(inv.invoiceDate)
              : null;
        if (!due || isNaN(due.getTime())) continue;
        const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
        if (daysOverdue < 0) continue;

        for (const b of AGING_BUCKETS) {
            if (
                daysOverdue >= b.min &&
                (b.max === null || daysOverdue <= b.max)
            ) {
                counts[b.key].count++;
                counts[b.key].total += outstanding;
                break;
            }
        }
    }

    const rows: unknown[][] = AGING_BUCKETS.map((b) => [
        b.key,
        counts[b.key].count,
        round2(counts[b.key].total),
    ]);

    const grandTotal = AGING_BUCKETS.reduce((sum, b) => sum + counts[b.key].total, 0);
    const grandCount = AGING_BUCKETS.reduce((sum, b) => sum + counts[b.key].count, 0);

    return {
        columns: ['bucket', 'count', 'total'],
        rows,
        summary: {
            outstanding_invoices: grandCount,
            outstanding_total: round2(grandTotal),
        },
    };
};

/* ─── Handler: payroll_summary ───────────────────────────────────────── */

const payrollSummary: Handler = async (ctx) => {
    const months = lastNMonths(ctx.asOf, 12);

    // Two possible shapes:
    //  - `crm_payroll_runs` with period_month/period_year + totals.
    //  - Legacy: aggregate `crm_payslips` directly.
    // Prefer the run summary doc since it's pre-aggregated.
    const runs = await ctx.db
        .collection('crm_payroll_runs')
        .find({ userId: ctx.tenantUserId })
        .toArray();

    const byKey = new Map<string, { employees: number; gross: number; deductions: number; net: number }>();
    for (const r of runs as any[]) {
        const yyyy = Number(r.period_year);
        const mm = Number(r.period_month);
        if (!Number.isFinite(yyyy) || !Number.isFinite(mm)) continue;
        const key = `${yyyy}-${String(mm).padStart(2, '0')}`;
        const cur = byKey.get(key) ?? { employees: 0, gross: 0, deductions: 0, net: 0 };
        cur.employees += Number(r.total_employees ?? 0) || 0;
        cur.gross += Number(r.total_gross ?? 0) || 0;
        cur.deductions += Number(r.total_deductions ?? 0) || 0;
        cur.net += Number(r.total_net ?? 0) || 0;
        byKey.set(key, cur);
    }

    const rows: unknown[][] = [];
    let tot = { employees: 0, gross: 0, deductions: 0, net: 0 };
    for (const m of months) {
        const cur = byKey.get(m.key) ?? { employees: 0, gross: 0, deductions: 0, net: 0 };
        rows.push([m.key, cur.employees, round2(cur.gross), round2(cur.deductions), round2(cur.net)]);
        tot.employees += cur.employees;
        tot.gross += cur.gross;
        tot.deductions += cur.deductions;
        tot.net += cur.net;
    }

    return {
        columns: ['month', 'employees', 'gross', 'deductions', 'net'],
        rows,
        summary: {
            employees: tot.employees,
            gross: round2(tot.gross),
            deductions: round2(tot.deductions),
            net: round2(tot.net),
        },
    };
};

/* ─── Handler: gstr1 ─────────────────────────────────────────────────── */

/**
 * Pull the period from `filters.custom` (`{ month, year }`) — falling
 * back to the month containing `asOf` so a quick "current month" call
 * works without filter wiring.
 */
function resolvePeriod(ctx: HandlerContext): { month: number; year: number } {
    const raw = (ctx.filters?.custom ?? {}) as { month?: unknown; year?: unknown };
    const month = Number(raw.month);
    const year = Number(raw.year);
    if (
        Number.isFinite(month) &&
        Number.isFinite(year) &&
        month >= 1 &&
        month <= 12
    ) {
        return { month, year };
    }
    return {
        month: ctx.asOf.getUTCMonth() + 1,
        year: ctx.asOf.getUTCFullYear(),
    };
}

const gstr1Handler: Handler = async (ctx) => {
    const period = resolvePeriod(ctx);
    const result = await generateGstr1(ctx.db, ctx.tenantUserId, period);
    const projected = projectGstr1ToReportResult(result);
    return {
        columns: projected.columns,
        rows: projected.rows,
        summary: { ...projected.summary, period_month: period.month, period_year: period.year },
    };
};

/* ─── Handler: gstr3b ────────────────────────────────────────────────── */

const gstr3bHandler: Handler = async (ctx) => {
    const period = resolvePeriod(ctx);
    const result = await generateGstr3b(ctx.db, ctx.tenantUserId, period);
    const projected = projectGstr3bToReportResult(result);
    return {
        columns: projected.columns,
        rows: projected.rows,
        summary: { ...projected.summary, period_month: period.month, period_year: period.year },
    };
};

/* ─── Handler: gstr2b ────────────────────────────────────────────────── */

/**
 * Reads a previously-imported GSTR-2B JSON from `crm_gstr2b_imports`
 * (keyed by tenant + period). Returns `gstr2b_import_required` when
 * the user hasn't uploaded the period's JSON yet.
 */
const gstr2bHandler: Handler = async (ctx) => {
    const period = resolvePeriod(ctx);
    const periodKey = `${String(period.month).padStart(2, '0')}-${period.year}`;
    const imported = (await ctx.db
        .collection('crm_gstr2b_imports')
        .findOne({ userId: ctx.tenantUserId, period: periodKey })) as
        | (Gstr2bReturn & { _id?: unknown })
        | null;
    if (!imported) {
        return {
            columns: [],
            rows: [],
            error: 'gstr2b_import_required',
            summary: { period_month: period.month, period_year: period.year },
        };
    }
    const projected = projectGstr2bToReportResult(imported);
    return {
        columns: projected.columns,
        rows: projected.rows,
        summary: { ...projected.summary, period_month: period.month, period_year: period.year },
    };
};

/* ─── Dispatch table ─────────────────────────────────────────────────── */

const HANDLERS: Partial<Record<ReportKind, Handler>> = {
    sales_summary: salesSummary,
    lead_funnel: leadFunnel,
    task_completion: taskCompletion,
    invoice_aging: invoiceAging,
    payroll_summary: payrollSummary,
    gstr1: gstr1Handler,
    gstr3b: gstr3bHandler,
    gstr2b: gstr2bHandler,
};

/** Quick predicate for callers that want to surface "real vs stub". */
export function isReportKindImplemented(kind: ReportKind): boolean {
    return HANDLERS[kind] !== undefined;
}

/** Sorted list of implemented kinds, for diagnostics + the UI. */
export function implementedReportKinds(): ReportKind[] {
    return Object.keys(HANDLERS).sort() as ReportKind[];
}

/* ─── CSV serialization ──────────────────────────────────────────────── */

/**
 * Serialize a `ReportRunResult` to CSV. RFC 4180 quoting: any field
 * containing `,`, `"`, `\n`, or `\r` is wrapped in double-quotes; inner
 * `"` becomes `""`.
 */
export function reportResultToCsv(result: ReportRunResult): string {
    const lines: string[] = [];
    lines.push(result.columns.map(csvField).join(','));
    for (const row of result.rows) {
        lines.push(row.map(csvField).join(','));
    }
    return lines.join('\n');
}

function csvField(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/* ─── Misc helpers ───────────────────────────────────────────────────── */

function round2(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
}

/* ─── Test surface ───────────────────────────────────────────────────── */

export const __internal = {
    salesSummary,
    leadFunnel,
    taskCompletion,
    invoiceAging,
    payrollSummary,
    lastNMonths,
};
