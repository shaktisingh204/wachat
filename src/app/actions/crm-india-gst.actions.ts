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
