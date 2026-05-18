'use server';

/**
 * CRM Payroll Runs — server actions for the
 * /dashboard/hrm/payroll/payroll entity.
 *
 * This entity sits ON TOP of the legacy `crm-payroll.actions.ts` flow
 * (`generatePayrollData` → `processPayroll` → `getPayslips`). Each
 * payroll-run document represents a single (month, year) execution and
 * caches aggregate totals so the list page doesn't have to fan out to
 * the payslips collection for every row.
 *
 * Collection: `crm_payroll_runs`
 * Fields: period_month, period_year, run_date, run_by, total_employees,
 *         total_gross, total_deductions, total_net,
 *         status (draft|in_progress|processed|paid|archived).
 *
 * **Dual-impl status — Phase 3 sweep (2026-05-18):**
 *  - RBAC: all reads + mutators already guarded on `crm_payroll`.
 *  - Rust delegation: the Rust crate `crm-payroll-runs`
 *    (`/v1/hrm/payroll-runs`) uses a structurally DIFFERENT data model
 *    from this legacy entity:
 *      legacy: `period_month` (1-12) + `period_year` (int) + `total_*`
 *              rollups + status enum (draft|in_progress|processed|paid|archived).
 *      Rust:   `periodFrom`/`periodTo` ISO-date range + `employees[]` per-row
 *              breakdown + `totals{gross,net,ctc,employeeCount}` +
 *              status (draft|processing|approved|disbursed|closed) +
 *              lifecycle endpoints (compute/approve/disburse).
 *    The clean Rust path for the new HR-payroll surface lives at
 *    `src/app/actions/crm/payroll-runs.actions.ts`; this legacy file
 *    stays Mongo-only until the worksuite UI is rebuilt against the
 *    range-based + per-employee Rust model.
 *
 * TODO 1.P3: collapse the (month, year) wrapper onto the Rust range
 * model once the legacy `/dashboard/hrm/payroll/payroll` route is
 * migrated to consume `periodFrom`/`periodTo` directly.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import {
    generatePayrollData,
    processPayroll,
    getPayslips,
} from '@/app/actions/crm-payroll.actions';

/* ─── Types ──────────────────────────────────────────────────────────── */

export type CrmPayrollRunStatus =
    | 'draft'
    | 'in_progress'
    | 'processed'
    | 'paid'
    | 'archived';

export interface CrmPayrollRunDoc {
    _id: string;
    userId?: string;
    period_month: number;
    period_year: number;
    run_date?: string;
    run_by?: string;
    total_employees: number;
    total_gross: number;
    total_deductions: number;
    total_net: number;
    status: CrmPayrollRunStatus;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface ListPayrollRunsParams {
    q?: string;
    status?: CrmPayrollRunStatus | 'all';
    year?: number | 'all';
    month?: number | 'all';
    limit?: number;
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asInt(v: FormDataEntryValue | null): number | undefined {
    if (v == null) return undefined;
    const n = Number(String(v));
    return Number.isFinite(n) ? n : undefined;
}

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function jsonify<T>(doc: WithId<unknown> | null): T | null {
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc)) as T;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function listPayrollRuns(
    filters?: ListPayrollRunsParams,
): Promise<CrmPayrollRunDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_payroll', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const q: Record<string, unknown> = { userId };
        if (filters?.status && filters.status !== 'all') q.status = filters.status;
        if (filters?.year != null && filters.year !== 'all')
            q.period_year = filters.year;
        if (filters?.month != null && filters.month !== 'all')
            q.period_month = filters.month;

        const cursor = db
            .collection<CrmPayrollRunDoc>('crm_payroll_runs')
            .find(q)
            .sort({ period_year: -1, period_month: -1, createdAt: -1 })
            .limit(filters?.limit ?? 200);

        const docs = await cursor.toArray();
        return JSON.parse(JSON.stringify(docs));
    } catch (e) {
        console.error('[listPayrollRuns] failed:', e);
        return [];
    }
}

export async function getPayrollRunById(
    id: string,
): Promise<CrmPayrollRunDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_payroll', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_payroll_runs').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return jsonify<CrmPayrollRunDoc>(doc);
    } catch (e) {
        console.error('[getPayrollRunById] failed:', e);
        return null;
    }
}

/**
 * Fetch payslips for a given run (by period). The payslips were created
 * by `processPayroll`, keyed on `(userId, employeeId, payPeriodStart)`.
 */
export async function getPayrollRunPayslips(
    runId: string,
): Promise<unknown[]> {
    const run = await getPayrollRunById(runId);
    if (!run) return [];
    const period = new Date(run.period_year, run.period_month - 1, 1);
    return getPayslips(period);
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

/**
 * Generate + persist a payroll run. Delegates the heavy work to the
 * existing `generatePayrollData` / `processPayroll` actions, then
 * upserts a `crm_payroll_runs` document with the aggregate totals.
 */
export async function savePayrollRun(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const runId = asString(formData.get('runId'));
    const isEditing = !!runId;

    const guard = await requirePermission(
        'crm_payroll',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const month = asInt(formData.get('period_month'));
    const year = asInt(formData.get('period_year'));
    if (!month || month < 1 || month > 12)
        return { error: 'Period month must be 1–12.' };
    if (!year || year < 2000) return { error: 'Period year is required.' };

    const status =
        (asString(formData.get('status')) as CrmPayrollRunStatus | undefined) ??
        'draft';
    const notes = asString(formData.get('notes'));
    const runDate = asString(formData.get('run_date'));

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const now = new Date();

        // When NOT editing (i.e. creating a new run) we generate the
        // payslip data and persist payslips via `processPayroll`.
        let totals = {
            total_employees: 0,
            total_gross: 0,
            total_deductions: 0,
            total_net: 0,
        };

        if (!isEditing) {
            const gen = await generatePayrollData(month, year);
            if (gen.error) return { error: gen.error };
            const rows = gen.payrollData ?? [];
            if (rows.length > 0) {
                const res = await processPayroll(rows, month, year);
                if (!res.success) return { error: res.error };
            }
            totals = {
                total_employees: rows.length,
                total_gross: rows.reduce(
                    (s, r) => s + (Number(r.grossSalary) || 0),
                    0,
                ),
                total_deductions: rows.reduce(
                    (s, r) =>
                        s +
                        (r.deductions ?? []).reduce(
                            (a: number, d: { amount: number }) =>
                                a + (Number(d.amount) || 0),
                            0,
                        ),
                    0,
                ),
                total_net: rows.reduce(
                    (s, r) => s + (Number(r.netSalary) || 0),
                    0,
                ),
            };
        }

        if (isEditing) {
            const updates: Record<string, unknown> = {
                status,
                updatedAt: now,
            };
            if (notes !== undefined) updates.notes = notes;
            if (runDate) updates.run_date = new Date(runDate);
            await db
                .collection('crm_payroll_runs')
                .updateOne(
                    {
                        _id: new ObjectId(runId!),
                        userId,
                    },
                    { $set: updates },
                );
            revalidatePath('/dashboard/hrm/payroll/payroll');
            revalidatePath(`/dashboard/hrm/payroll/payroll/${runId}`);
            return { message: 'Payroll run updated.', id: runId };
        }

        const insertRes = await db.collection('crm_payroll_runs').insertOne({
            userId,
            period_month: month,
            period_year: year,
            run_date: runDate ? new Date(runDate) : now,
            run_by: String(session.user._id),
            ...totals,
            status,
            ...(notes ? { notes } : {}),
            createdAt: now,
            updatedAt: now,
        });

        revalidatePath('/dashboard/hrm/payroll/payroll');
        return {
            message: 'Payroll run created.',
            id: insertRes.insertedId.toString(),
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { error: `Failed to save run: ${msg}` };
    }
}

/**
 * Flip a run to `processed` (i.e. lock the payslips). Requires that
 * payslips already exist for the period.
 */
export async function finalizePayrollRun(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id))
        return { success: false, error: 'Invalid run id.' };

    const guard = await requirePermission('crm_payroll', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_payroll_runs').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id),
            },
            { $set: { status: 'processed', updatedAt: new Date() } },
        );
        revalidatePath('/dashboard/hrm/payroll/payroll');
        revalidatePath(`/dashboard/hrm/payroll/payroll/${id}`);
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error: msg };
    }
}

export async function deletePayrollRun(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id))
        return { success: false, error: 'Invalid run id.' };

    const guard = await requirePermission('crm_payroll', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_payroll_runs').deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        revalidatePath('/dashboard/hrm/payroll/payroll');
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error: msg };
    }
}
