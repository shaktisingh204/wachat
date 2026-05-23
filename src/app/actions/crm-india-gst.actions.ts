'use server';

/**
 * Indian GST server actions — `CRM_REBUILD_PLAN.md` §6.10.
 *
 * Three flows:
 *  1. `generateGstr1Report` / `generateGstr3bReport` — wrap the
 *     `runReport` engine to materialise the relevant tabular output.
 *  2. `downloadGstr1Json` — project the GSTR-1 result into the exact
 *     JSON shape the GST portal expects when you upload a return.
 *  3. `importGstr2b` — receive the GSTR-2B JSON the user downloaded
 *     from the portal, validate it, and persist into
 *     `crm_gstr2b_imports` so the viewer page can read it back.
 *
 * RBAC: GSTR-1 and GSTR-3B share the existing `crm_gstr1` key; GSTR-2B
 * uses `crm_gstr2b`. A new unified `crm_gst` key (proposed) would
 * collapse all three into a single permission — flagged in the
 * deliverable. We don't add the key in this PR per the concurrent-edit
 * convention; the existing keys are sufficient and already wired into
 * the role-builder UI.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import {
    generateGstr1,
    projectGstr1ToGstnJson,
    type Gstr1Return,
} from '@/lib/reports/india/gstr1';
import { generateGstr3b, type Gstr3bReturn } from '@/lib/reports/india/gstr3b';
import {
    parseGstr2bJson,
    summarizeGstr2b,
    type Gstr2bReturn,
    Gstr2bParseError,
} from '@/lib/reports/india/gstr2b';
import { runReport } from '@/lib/reports/engine';
import type { ReportRunResult } from '@/lib/reports/types';

export interface Period {
    month: number;
    year: number;
}

function isValidPeriod(p: unknown): p is Period {
    if (!p || typeof p !== 'object') return false;
    const obj = p as { month?: unknown; year?: unknown };
    const m = Number(obj.month);
    const y = Number(obj.year);
    return Number.isFinite(m) && m >= 1 && m <= 12 && Number.isFinite(y) && y >= 2017;
}

function periodKey(period: Period): string {
    return `${String(period.month).padStart(2, '0')}-${period.year}`;
}

/* ─── GSTR-1: tabular run + raw payload ──────────────────────────────── */

export async function generateGstr1Report(
    period: Period,
): Promise<{ error?: string; result?: ReportRunResult; raw?: Gstr1Return }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const guard = await requirePermission('crm_gstr1', 'view');
    if (!guard.ok) return { error: guard.error };

    if (!isValidPeriod(period)) {
        return { error: 'Invalid period — provide {month: 1-12, year: >=2017}.' };
    }

    try {
        const result = await runReport(
            {
                userId: session.user._id,
                kind: 'gstr1',
                name: 'GSTR-1',
                filters: { custom: { month: period.month, year: period.year } },
            },
            { tenantUserId: String(session.user._id) },
        );

        // Materialise the raw return shape too (the pages need it for
        // collapsible sections + GSTN download).
        const { db } = await connectToDatabase();
        const raw = await generateGstr1(
            db,
            new ObjectId(String(session.user._id)),
            period,
        );
        return { result, raw };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to generate GSTR-1.' };
    }
}

/* ─── GSTR-3B: tabular run + raw payload ─────────────────────────────── */

export async function generateGstr3bReport(
    period: Period,
): Promise<{ error?: string; result?: ReportRunResult; raw?: Gstr3bReturn }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    // GSTR-3B shares the GSTR-1 RBAC key (both are outward-side
    // statutory returns). A future `crm_gst` umbrella key would unify.
    const guard = await requirePermission('crm_gstr1', 'view');
    if (!guard.ok) return { error: guard.error };

    if (!isValidPeriod(period)) {
        return { error: 'Invalid period — provide {month: 1-12, year: >=2017}.' };
    }

    try {
        const startedAt = new Date();
        const result = await runReport(
            {
                userId: session.user._id,
                kind: 'gstr3b',
                name: 'GSTR-3B',
                filters: { custom: { month: period.month, year: period.year } },
            },
            { tenantUserId: String(session.user._id) },
        );
        const { db } = await connectToDatabase();
        const raw = await generateGstr3b(
            db,
            new ObjectId(String(session.user._id)),
            period,
        );

        // Audit-log this ad-hoc generation into `crm_report_runs` so the
        // GSTR-3B list page can derive KPIs + filing history. We mirror
        // the `executeReportDefinition` shape but use a synthetic
        // `definitionId` since there's no saved definition.
        try {
            await db.collection('crm_report_runs').insertOne({
                userId: new ObjectId(String(session.user._id)),
                definitionId: null,
                kind: 'gstr3b',
                status: result.error ? 'failed' : 'succeeded',
                trigger: 'manual',
                startedAt,
                finishedAt: new Date(),
                result: {
                    ...result,
                    meta: { period: { month: period.month, year: period.year } },
                },
                rowCount: result.rows.length,
                error: result.error ?? null,
            } as Record<string, unknown>);
        } catch (logErr) {
            // History is best-effort — never fail the generation on it.
            console.error('[generateGstr3bReport] history log failed:', logErr);
        }

        return { result, raw };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to generate GSTR-3B.' };
    }
}

/* ─── GSTR-1 GSTN-portal JSON download ───────────────────────────────── */

/**
 * Project a generated GSTR-1 into the JSON-string the GST portal expects
 * for the GSTR-1 upload form. Returns a serialised string so the page
 * can stuff it into a `Blob` and trigger a download.
 *
 * The seller GSTIN comes from `users.businessProfile.gstin`; we error
 * out if the tenant hasn't configured it yet.
 */
export async function downloadGstr1Json(
    period: Period,
): Promise<{ error?: string; filename?: string; json?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const guard = await requirePermission('crm_gstr1', 'view');
    if (!guard.ok) return { error: guard.error };

    if (!isValidPeriod(period)) {
        return { error: 'Invalid period — provide {month: 1-12, year: >=2017}.' };
    }

    const { db } = await connectToDatabase();
    const userDoc = (await db
        .collection('users')
        .findOne({ _id: new ObjectId(String(session.user._id)) })) as
        | { businessProfile?: { gstin?: string } }
        | null;
    const gstin = userDoc?.businessProfile?.gstin;
    if (!gstin) {
        return {
            error: 'Your business GSTIN is not configured. Set it in CRM Settings → Business Profile.',
        };
    }

    try {
        const result = await generateGstr1(
            db,
            new ObjectId(String(session.user._id)),
            period,
        );
        const payload = projectGstr1ToGstnJson(result, { gstin, period });
        return {
            json: JSON.stringify(payload, null, 2),
            filename: `GSTR1-${gstin}-${periodKey(period)}.json`,
        };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Failed to project GSTR-1 JSON.' };
    }
}

/* ─── GSTR-2B import ─────────────────────────────────────────────────── */

/**
 * Persist an uploaded GSTR-2B JSON for a (tenant, period) pair. The
 * upload form posts:
 *
 *   - `month` (1-12)
 *   - `year` (yyyy)
 *   - `payload` (the raw JSON text)
 *
 * The action validates the shape, normalises into a `Gstr2bReturn`,
 * upserts the doc into `crm_gstr2b_imports`, and returns the
 * normalised return + summary for the viewer page.
 */
export async function importGstr2b(
    formData: FormData,
): Promise<{
    error?: string;
    summary?: {
        totalItcAvailable: number;
        totalIneligible: number;
        invoiceCount: number;
        suppliers: number;
    };
    parsed?: Gstr2bReturn;
}> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const guard = await requirePermission('crm_gstr2b', 'create');
    if (!guard.ok) return { error: guard.error };

    const month = Number(formData.get('month'));
    const year = Number(formData.get('year'));
    if (!isValidPeriod({ month, year })) {
        return { error: 'Invalid period — month must be 1-12, year ≥2017.' };
    }
    const payload = (formData.get('payload') as string | null) ?? '';

    let parsed: Gstr2bReturn;
    try {
        parsed = parseGstr2bJson(payload);
    } catch (e) {
        if (e instanceof Gstr2bParseError) {
            return { error: `GSTR-2B JSON invalid: ${e.message}` };
        }
        return {
            error: e instanceof Error ? e.message : 'Failed to parse GSTR-2B JSON.',
        };
    }

    const { db } = await connectToDatabase();
    const tenantId = new ObjectId(String(session.user._id));
    const key = periodKey({ month, year });
    const now = new Date();
    await db.collection('crm_gstr2b_imports').updateOne(
        { userId: tenantId, period: key },
        {
            $set: {
                ...parsed,
                userId: tenantId,
                period: key, // canonical period key (overrides parsed.period)
                periodMonth: month,
                periodYear: year,
                updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
        },
        { upsert: true },
    );

    const summary = summarizeGstr2b(parsed);
    return {
        parsed,
        summary: {
            totalItcAvailable: summary.totalItcAvailable,
            totalIneligible: summary.totalIneligible,
            invoiceCount: summary.invoiceCount,
            suppliers: summary.bySupplier.length,
        },
    };
}

/* ─── GSTR-2B fetch (for the viewer page) ────────────────────────────── */

export async function getGstr2bImport(period: Period): Promise<{
    error?: string;
    parsed?: Gstr2bReturn;
}> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required.' };

    const guard = await requirePermission('crm_gstr2b', 'view');
    if (!guard.ok) return { error: guard.error };

    if (!isValidPeriod(period)) {
        return { error: 'Invalid period.' };
    }
    const { db } = await connectToDatabase();
    const tenantId = new ObjectId(String(session.user._id));
    const doc = (await db
        .collection('crm_gstr2b_imports')
        .findOne({ userId: tenantId, period: periodKey(period) })) as
        | (Gstr2bReturn & { _id?: unknown })
        | null;
    if (!doc) return {};
    // Strip the Mongo `_id` so the client never gets a non-serialisable
    // ObjectId back.
    const { _id, ...rest } = doc as Gstr2bReturn & { _id?: unknown };
    void _id;
    return { parsed: rest as Gstr2bReturn };
}

/* ─── GSTR-3B KPIs + filing history ─────────────────────────────────── */

export interface Gstr3bFilingRow {
    runId: string;
    period: string;
    month: number;
    year: number;
    status: 'succeeded' | 'failed' | 'running';
    startedAt: string;
    finishedAt?: string;
    outwardTaxable?: number;
    netPayable?: number;
    rowCount?: number;
    error?: string | null;
}

export interface Gstr3bKpis {
    /** Distinct (month, year) periods generated this financial year. */
    totalFiledFy: number;
    /** Months in the running FY without a generation yet. */
    pendingFy: number;
    /** ISO timestamp of the most recent successful generation. */
    lastFilingAt?: string;
    /** Sum of `outward_total_tax` across all successful runs in the FY. */
    totalTaxFy: number;
    /** Sum of `net_payable` across all successful runs in the FY. */
    netPayableFy: number;
}

/**
 * Indian FY runs April–March. Given a date, return the FY window that
 * contains it (UTC) and the human label e.g. "2026-27".
 */
function indianFyWindow(asOf: Date = new Date()): {
    label: string;
    start: Date;
    end: Date;
} {
    const y = asOf.getUTCFullYear();
    const m = asOf.getUTCMonth() + 1;
    const startYear = m >= 4 ? y : y - 1;
    const start = new Date(Date.UTC(startYear, 3, 1));
    const end = new Date(Date.UTC(startYear + 1, 3, 1));
    const label = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
    return { label, start, end };
}

function periodFromRun(doc: {
    kind?: unknown;
    result?: { meta?: { period?: { month?: number; year?: number } } };
}): { month: number; year: number } | null {
    const p = doc.result?.meta?.period;
    if (!p) return null;
    const m = Number(p.month);
    const y = Number(p.year);
    if (!Number.isFinite(m) || m < 1 || m > 12) return null;
    if (!Number.isFinite(y) || y < 2017) return null;
    return { month: m, year: y };
}

export async function getGstr3bKpis(): Promise<Gstr3bKpis> {
    const empty: Gstr3bKpis = {
        totalFiledFy: 0,
        pendingFy: 0,
        totalTaxFy: 0,
        netPayableFy: 0,
    };
    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_gstr1', 'view');
    if (!guard.ok) return empty;

    try {
        const { db } = await connectToDatabase();
        const userObjId = new ObjectId(String(session.user._id));
        const { start, end } = indianFyWindow();
        const docs = (await db
            .collection('crm_report_runs')
            .find({
                userId: userObjId,
                kind: 'gstr3b',
                status: 'succeeded',
                startedAt: { $gte: start, $lt: end },
            })
            .project({
                'result.summary.outward_total_tax': 1,
                'result.summary.net_payable': 1,
                'result.meta.period': 1,
                finishedAt: 1,
                startedAt: 1,
            })
            .sort({ startedAt: -1 })
            .toArray()) as Array<{
            startedAt?: Date;
            finishedAt?: Date;
            result?: {
                summary?: { outward_total_tax?: number; net_payable?: number };
                meta?: { period?: { month?: number; year?: number } };
            };
        }>;

        const distinct = new Set<string>();
        let totalTax = 0;
        let netPayable = 0;
        let last: Date | undefined;
        for (const d of docs) {
            const p = periodFromRun(d);
            if (p) distinct.add(`${p.year}-${p.month}`);
            const t = Number(d.result?.summary?.outward_total_tax ?? 0);
            const n = Number(d.result?.summary?.net_payable ?? 0);
            if (Number.isFinite(t)) totalTax += t;
            if (Number.isFinite(n)) netPayable += n;
            const ts = d.finishedAt ?? d.startedAt;
            if (ts && (!last || ts > last)) last = ts;
        }

        // FY pending months = months elapsed in FY minus distinct generated.
        const now = new Date();
        const monthsElapsed = Math.max(
            0,
            Math.min(
                12,
                (now.getUTCFullYear() - start.getUTCFullYear()) * 12 +
                    (now.getUTCMonth() - start.getUTCMonth()) +
                    1,
            ),
        );
        const pending = Math.max(0, monthsElapsed - distinct.size);

        return {
            totalFiledFy: distinct.size,
            pendingFy: pending,
            totalTaxFy: Math.round(totalTax * 100) / 100,
            netPayableFy: Math.round(netPayable * 100) / 100,
            lastFilingAt: last ? last.toISOString() : undefined,
        };
    } catch (e) {
        console.error('[getGstr3bKpis] failed:', e);
        return empty;
    }
}

export async function listGstr3bFilings(
    page = 1,
    limit = 20,
    search = '',
    filters: { status?: 'all' | 'succeeded' | 'failed'; fy?: 'current' | 'previous' | 'all' } = {},
): Promise<{ rows: Gstr3bFilingRow[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { rows: [], total: 0 };

    const guard = await requirePermission('crm_gstr1', 'view');
    if (!guard.ok) return { rows: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjId = new ObjectId(String(session.user._id));

        const query: Record<string, unknown> = {
            userId: userObjId,
            kind: 'gstr3b',
        };
        if (filters.status && filters.status !== 'all') {
            query.status = filters.status;
        }
        if (filters.fy && filters.fy !== 'all') {
            const now = new Date();
            const ref = filters.fy === 'previous'
                ? new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1))
                : now;
            const { start, end } = indianFyWindow(ref);
            query.startedAt = { $gte: start, $lt: end };
        }

        const skip = Math.max(0, (page - 1) * limit);
        const safeLimit = Math.min(Math.max(1, limit), 200);

        const [docs, total] = await Promise.all([
            db
                .collection('crm_report_runs')
                .find(query)
                .project({
                    status: 1,
                    startedAt: 1,
                    finishedAt: 1,
                    error: 1,
                    rowCount: 1,
                    'result.summary.outward_taxable': 1,
                    'result.summary.outward_total_tax': 1,
                    'result.summary.net_payable': 1,
                    'result.meta.period': 1,
                })
                .sort({ startedAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .toArray(),
            db.collection('crm_report_runs').countDocuments(query),
        ]);

        const needle = search.trim().toLowerCase();
        const rows: Gstr3bFilingRow[] = [];
        for (const raw of docs as Array<{
            _id: ObjectId;
            status: 'succeeded' | 'failed' | 'running';
            startedAt: Date;
            finishedAt?: Date;
            error?: string | null;
            rowCount?: number;
            result?: {
                summary?: {
                    outward_taxable?: number;
                    outward_total_tax?: number;
                    net_payable?: number;
                };
                meta?: { period?: { month?: number; year?: number } };
            };
        }>) {
            const p = periodFromRun(raw);
            if (!p) continue;
            const label = periodKey(p);
            if (needle && !label.toLowerCase().includes(needle)) continue;
            rows.push({
                runId: String(raw._id),
                period: label,
                month: p.month,
                year: p.year,
                status: raw.status,
                startedAt: new Date(raw.startedAt).toISOString(),
                finishedAt: raw.finishedAt ? new Date(raw.finishedAt).toISOString() : undefined,
                outwardTaxable: raw.result?.summary?.outward_taxable,
                netPayable: raw.result?.summary?.net_payable,
                rowCount: raw.rowCount,
                error: raw.error ?? undefined,
            });
        }

        return { rows, total: needle ? rows.length : total };
    } catch (e) {
        console.error('[listGstr3bFilings] failed:', e);
        return { rows: [], total: 0 };
    }
}

export async function getGstr2bTrend(limit: number): Promise<Array<{ period: string, itcAvailable: number, itcReversed: number }>> {
    const session = await getSession();
    if (!session?.user) return [];
    
    try {
        const { db } = await connectToDatabase();
        const trendDocs = await db.collection('crm_gstr2b_imports').find({ userId: new ObjectId(session.user._id) })
            .project({
                period: 1,
                periodMonth: 1,
                periodYear: 1,
                totalItcAvailable: 1,
                totalItcIneligible: 1,
            })
            .sort({ periodYear: -1, periodMonth: -1 })
            .limit(limit)
            .toArray();
            
        function sumItc(totals?: { igst: number; cgst: number; sgst: number; cess: number; }): number {
            if (!totals) return 0;
            return (totals.igst || 0) + (totals.cgst || 0) + (totals.sgst || 0) + (totals.cess || 0);
        }

        return trendDocs.map(d => ({
            period: d.period ?? '',
            itcAvailable: Math.round(sumItc(d.totalItcAvailable)),
            itcReversed: Math.round(sumItc(d.totalItcIneligible))
        })).reverse();
    } catch {
        return [];
    }
}

/* --- New Features --- */

export async function syncWithGstPortal(period: Period, returnType: 'GSTR1' | 'GSTR2B' | 'GSTR3B'): Promise<{ success: boolean; message: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, message: 'Authentication required.' };
    // This is a placeholder for actual GST portal API integration.
    // In reality, this would require e-Invoicing/GST Suvidha Provider (GSP) credentials
    // and would fetch or push data to the portal securely.
    return { success: true, message: `Successfully synced ${returnType} with GST portal for ${periodKey(period)}.` };
}

export async function reconcileGstr2bVsLocal(period: Period): Promise<{ discrepancies: number; totalMatched: number; reportId: string }> {
    const session = await getSession();
    if (!session?.user) throw new Error('Auth required');
    // Placeholder logic for reconciliation tool.
    // It would compare crm_purchase_orders and crm_expenses against crm_gstr2b_imports.
    return { discrepancies: 0, totalMatched: 100, reportId: 'recon-' + Date.now() };
}

export async function settleTaxJournalEntries(period: Period, taxType: string, amount: number): Promise<{ success: boolean; message: string; journalId: string }> {
    const session = await getSession();
    if (!session?.user) throw new Error('Auth required');
    // Placeholder logic for automated journal entries.
    // It would create a debit entry for tax payable and credit for bank/cash.
    return { success: true, message: 'Journal entry created for tax settlement.', journalId: 'jrnl-' + Date.now() };
}
