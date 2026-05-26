'use server';

/**
 * CRM HR Professional Tax — Mongo-backed server actions.
 *
 * State-aware monthly PT records. Collection: `crm_professional_tax_records`.
 *   - employeeId, employeeName
 *   - state                  (e.g. "Karnataka")
 *   - month ("YYYY-MM"), grossSalary, ptAmount
 *   - slabApplied            (descriptor of the slab in force at save time —
 *                             e.g. "KA: ₹15,000–₹24,999 → ₹200/mo")
 *   - depositDate (Date), challanNumber
 *   - status: 'pending' | 'deposited' | 'filed' | 'archived'
 *   - notes
 *
 * `slabApplied` is stamped on the record at create/update time so that
 * later slab changes do not retroactively alter historical filings.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';
import {
  runBulkImport,
  type BulkImportAdapter,
  type BulkImportContext,
  type BulkImportReport,
  type DedupPolicy,
} from '@/lib/bulk-io';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmProfessionalTaxApi,
    type CrmProfessionalTaxCreateInput,
    type CrmProfessionalTaxUpdateInput,
} from '@/lib/rust-client/crm-professional-tax';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ─────────────────────────────────────────────────────────── */

export type CrmProfessionalTaxStatus =
    | 'pending'
    | 'deposited'
    | 'filed'
    | 'archived';

export interface CrmProfessionalTaxListFilters {
    q?: string;
    status?: CrmProfessionalTaxStatus | 'all';
    state?: string;
    month?: string; // YYYY-MM
    limit?: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function isValidMonth(m: string): boolean {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

const VALID_STATUSES = new Set<CrmProfessionalTaxStatus>([
    'pending',
    'deposited',
    'filed',
    'archived',
]);

/**
 * Find the PT slab for a `(state, grossSalary)` pair and return a human-
 * readable descriptor. Falls back to a generic "manual" string if no
 * matching slab exists.
 */
async function resolveSlabApplied(
    userId: ObjectId,
    state: string,
    grossSalary: number,
): Promise<string> {
    try {
        const { db } = await connectToDatabase();
        const slab = await db.collection('crm_pt_slabs').findOne({
            userId,
            state,
            minSalary: { $lte: grossSalary },
            maxSalary: { $gte: grossSalary },
        });
        if (slab) {
            const min = Number(slab.minSalary ?? 0).toLocaleString('en-IN');
            const max = Number(slab.maxSalary ?? 0).toLocaleString('en-IN');
            const amt = Number(slab.taxAmount ?? 0).toLocaleString('en-IN');
            return `${state}: ₹${min}–₹${max} → ₹${amt}/mo`;
        }
    } catch (e) {
        console.error('[resolveSlabApplied] lookup failed:', e);
    }
    return `${state}: manual entry`;
}

/* ─── Reads ─────────────────────────────────────────────────────────── */

export async function getProfessionalTaxRecords(
    filters?: CrmProfessionalTaxListFilters,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const empty = { items: [], total: 0 };
    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_professional_tax', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmProfessionalTaxApi.list({
                q: filters?.q,
                status: filters?.status,
                state: filters?.state,
                month:
                    filters?.month && isValidMonth(filters.month)
                        ? filters.month
                        : undefined,
                limit: filters?.limit,
            });
            const items = res.items ?? [];
            return {
                items: JSON.parse(JSON.stringify(items)),
                total: items.length,
            };
        } catch (e) {
            console.error(
                '[getProfessionalTaxRecords] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'professional_tax_record',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);

        const filter: Record<string, unknown> = { userId: userObjectId };
        const status = filters?.status;
        if (status && status !== 'all') {
            filter.status = status;
        } else {
            filter.status = { $ne: 'archived' };
        }
        if (filters?.state) filter.state = filters.state;
        if (filters?.month && isValidMonth(filters.month)) {
            filter.month = filters.month;
        }
        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [
                { employeeName: re },
                { state: re },
                { challanNumber: re },
                { slabApplied: re },
                { month: re },
            ];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
        const cursor = db
            .collection('crm_professional_tax_records')
            .find(filter)
            .sort({ month: -1, state: 1, _id: -1 })
            .limit(limit);

        const docs = await cursor.toArray();
        const total = await db
            .collection('crm_professional_tax_records')
            .countDocuments(filter);
        return { items: JSON.parse(JSON.stringify(docs)), total };
    } catch (e) {
        console.error('[getProfessionalTaxRecords] failed:', e);
        return empty;
    }
}

export async function getProfessionalTaxRecordById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_professional_tax', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmProfessionalTaxApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as WithId<
                Record<string, unknown>
            >;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error(
                '[getProfessionalTaxRecordById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'professional_tax_record',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection('crm_professional_tax_records')
            .findOne({
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getProfessionalTaxRecordById] failed:', e);
        return null;
    }
}

/* ─── Writes ────────────────────────────────────────────────────────── */

export async function saveProfessionalTaxRecord(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const recordId = asString(formData.get('recordId'));
    const isEditing = !!recordId;

    const guard = await requirePermission(
        'crm_professional_tax',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeName = asString(formData.get('employeeName'));
    if (!employeeName) return { error: 'Employee name is required.' };

    const state = asString(formData.get('state'));
    if (!state) return { error: 'State is required.' };

    const month = asString(formData.get('month'));
    if (!month || !isValidMonth(month)) {
        return { error: 'Month must be in YYYY-MM format.' };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmProfessionalTaxStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmProfessionalTaxStatus)
            ? (statusRaw as CrmProfessionalTaxStatus)
            : 'pending';

    const employeeId = asString(formData.get('employeeId'));
    const grossSalary = asNumber(formData.get('grossSalary')) ?? 0;
    const ptAmount = asNumber(formData.get('ptAmount')) ?? 0;
    const challanNumber = asString(formData.get('challanNumber'));
    const depositDateRaw = asString(formData.get('depositDate'));
    const depositDate = depositDateRaw ? new Date(depositDateRaw) : undefined;
    const notes = asString(formData.get('notes'));

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        // Stamp slabApplied at save time so historical rows are not affected
        // by later slab edits.
        const slabApplied = await resolveSlabApplied(
            userObjectId,
            state,
            grossSalary,
        );

        if (useRustCrm()) {
            try {
                if (isEditing) {
                    if (!ObjectId.isValid(recordId!)) {
                        return { error: 'Invalid PT record id.' };
                    }
                    const patch: CrmProfessionalTaxUpdateInput = {
                        employeeName,
                        ...(employeeId !== undefined ? { employeeId } : {}),
                        state,
                        month,
                        grossSalary,
                        ptAmount,
                        slabApplied,
                        ...(challanNumber !== undefined ? { challanNumber } : {}),
                        ...(depositDate && !Number.isNaN(depositDate.getTime())
                            ? { depositDate: depositDate.toISOString() }
                            : {}),
                        status,
                        ...(notes !== undefined ? { notes } : {}),
                    };
                    await crmProfessionalTaxApi.update(recordId!, patch);

                    try {
                        await writeAuditEntry({
                            tenantUserId: String(session.user._id),
                            actorId: String(session.user._id),
                            action: 'update',
                            entityKind: 'professional_tax_record',
                            entityId: recordId!,
                        });
                    } catch {
                        /* non-fatal */
                    }

                    revalidatePath('/dashboard/hrm/payroll/professional-tax');
                    revalidatePath(
                        `/dashboard/hrm/payroll/professional-tax/${recordId}`,
                    );
                    return { message: 'PT record updated.', id: recordId };
                }

                const input: CrmProfessionalTaxCreateInput = {
                    ...(employeeId ? { employeeId } : {}),
                    employeeName,
                    state,
                    month,
                    grossSalary,
                    ptAmount,
                    slabApplied,
                    ...(challanNumber ? { challanNumber } : {}),
                    ...(depositDate && !Number.isNaN(depositDate.getTime())
                        ? { depositDate: depositDate.toISOString() }
                        : {}),
                    status,
                    ...(notes ? { notes } : {}),
                };
                const created = await crmProfessionalTaxApi.create(input);

                try {
                    await writeAuditEntry({
                        tenantUserId: String(session.user._id),
                        actorId: String(session.user._id),
                        action: 'create',
                        entityKind: 'professional_tax_record',
                        entityId: created.id,
                    });
                } catch {
                    /* non-fatal */
                }

                revalidatePath('/dashboard/hrm/payroll/professional-tax');
                return { message: 'PT record created.', id: created.id };
            } catch (e) {
                console.error(
                    '[saveProfessionalTaxRecord] rust path failed; falling back:',
                    e,
                );
                recordRustFallback({
                    entity: 'professional_tax_record',
                    op: isEditing ? 'update' : 'create',
                    errorCode: e instanceof RustApiError ? e.code : undefined,
                    status: e instanceof RustApiError ? e.status : undefined,
                });
            }
        }

        if (isEditing) {
            if (!ObjectId.isValid(recordId!)) {
                return { error: 'Invalid PT record id.' };
            }
            const existing = await db
                .collection('crm_professional_tax_records')
                .findOne({
                    _id: new ObjectId(recordId!),
                    userId: userObjectId,
                });
            if (!existing) return { error: 'PT record not found.' };

            const $set: Record<string, unknown> = {
                employeeName,
                ...(employeeId !== undefined ? { employeeId } : {}),
                state,
                month,
                grossSalary,
                ptAmount,
                slabApplied,
                ...(challanNumber
                    ? { challanNumber }
                    : { challanNumber: null }),
                ...(depositDate && !Number.isNaN(depositDate.getTime())
                    ? { depositDate }
                    : { depositDate: null }),
                status,
                ...(notes !== undefined ? { notes } : {}),
                updatedAt: now,
            };

            await db.collection('crm_professional_tax_records').updateOne(
                { _id: new ObjectId(recordId!), userId: userObjectId },
                { $set },
            );

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'professional_tax_record',
                    entityId: recordId!,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/hrm/payroll/professional-tax');
            revalidatePath(
                `/dashboard/hrm/payroll/professional-tax/${recordId}`,
            );
            return { message: 'PT record updated.', id: recordId };
        }

        const doc: Record<string, unknown> = {
            userId: userObjectId,
            employeeName,
            ...(employeeId ? { employeeId } : {}),
            state,
            month,
            grossSalary,
            ptAmount,
            slabApplied,
            ...(challanNumber ? { challanNumber } : {}),
            ...(depositDate && !Number.isNaN(depositDate.getTime())
                ? { depositDate }
                : {}),
            status,
            ...(notes ? { notes } : {}),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db
            .collection('crm_professional_tax_records')
            .insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'professional_tax_record',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/professional-tax');
        return {
            message: 'PT record created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save PT record: ${getErrorMessage(e)}` };
    }
}

export async function deleteProfessionalTaxRecord(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid PT record id.' };
    }

    const guard = await requirePermission('crm_professional_tax', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmProfessionalTaxApi.delete(id);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'professional_tax_record',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/hrm/payroll/professional-tax');
            return { success: true };
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { success: false, error: 'PT record not found.' };
            }
            console.error(
                '[deleteProfessionalTaxRecord] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'professional_tax_record',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db
            .collection('crm_professional_tax_records')
            .updateOne(
                {
                    _id: new ObjectId(id),
                    userId: new ObjectId(session.user._id as string),
                },
                { $set: { status: 'archived', updatedAt: new Date() } },
            );
        if (result.matchedCount === 0) {
            return { success: false, error: 'PT record not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'professional_tax_record',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/professional-tax');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── Bulk Import ───────────────────────────────────────────────────── */

export interface BulkImportActionInput {
    csv: string;
    dryRun?: boolean;
    dedup?: DedupPolicy;
    maxRows?: number;
}

export interface PTRecordDraft {
    employeeName: string;
    employeeId?: string;
    state: string;
    month: string;
    grossSalary?: number;
    ptAmount?: number;
    challanNumber?: string;
    depositDate?: Date;
    status: CrmProfessionalTaxStatus;
    notes?: string;
}

function s(v: string | undefined | null): string | undefined {
    const t = (v ?? '').trim();
    return t.length === 0 ? undefined : t;
}

function pickKey(row: Record<string, string>, ...candidates: string[]): string | undefined {
    for (const c of candidates) {
        const direct = row[c];
        if (direct !== undefined && String(direct).trim().length > 0) return direct;
        const lc = c.toLowerCase();
        for (const k of Object.keys(row)) {
            if (k.toLowerCase() === lc) {
                const v = row[k];
                if (v !== undefined && String(v).trim().length > 0) return v;
            }
        }
    }
    return undefined;
}

const PT_ADAPTER: BulkImportAdapter<PTRecordDraft> = {
    entityKind: 'professional_tax_record',
    mapRow(raw) {
        const employeeName = s(pickKey(raw, 'employeeName', 'employee', 'name'));
        if (!employeeName) return { ok: false, error: 'Missing employeeName' };
        
        const state = s(pickKey(raw, 'state'));
        if (!state) return { ok: false, error: 'Missing state' };

        const month = s(pickKey(raw, 'month', 'period'));
        if (!month || !isValidMonth(month)) return { ok: false, error: 'Month must be YYYY-MM' };

        const depositDateRaw = s(pickKey(raw, 'depositDate', 'date'));
        let depositDate: Date | undefined;
        if (depositDateRaw) {
            const d = new Date(depositDateRaw);
            if (!Number.isNaN(d.getTime())) depositDate = d;
        }

        const rawStatus = s(pickKey(raw, 'status'));
        const status = rawStatus && VALID_STATUSES.has(rawStatus.toLowerCase() as CrmProfessionalTaxStatus)
            ? (rawStatus.toLowerCase() as CrmProfessionalTaxStatus)
            : 'pending';

        return {
            ok: true,
            value: {
                employeeName,
                employeeId: s(pickKey(raw, 'employeeId', 'empId')),
                state,
                month,
                grossSalary: Number(pickKey(raw, 'grossSalary', 'salary') ?? 0),
                ptAmount: Number(pickKey(raw, 'ptAmount', 'amount', 'tax') ?? 0),
                challanNumber: s(pickKey(raw, 'challanNumber', 'challan')),
                depositDate,
                status,
                notes: s(pickKey(raw, 'notes', 'remarks')),
            },
        };
    },
    dedupKey(value) {
        return `${value.employeeName.toLowerCase()}|${value.month}|${value.state.toLowerCase()}`;
    },
    async insertOne(value, ctx) {
        const userObjectId = new ObjectId(ctx.userId);
        const slabApplied = await resolveSlabApplied(userObjectId, value.state, value.grossSalary ?? 0);
        
        const { db } = await connectToDatabase();
        const doc = {
            userId: userObjectId,
            employeeName: value.employeeName,
            ...(value.employeeId ? { employeeId: value.employeeId } : {}),
            state: value.state,
            month: value.month,
            grossSalary: value.grossSalary ?? 0,
            ptAmount: value.ptAmount ?? 0,
            slabApplied,
            ...(value.challanNumber ? { challanNumber: value.challanNumber } : {}),
            ...(value.depositDate ? { depositDate: value.depositDate } : {}),
            status: value.status,
            ...(value.notes ? { notes: value.notes } : {}),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const r = await db.collection('crm_professional_tax_records').insertOne(doc);
        return { id: r.insertedId.toString() };
    },
};

export async function importProfessionalTaxRecordsCsv(input: BulkImportActionInput): Promise<
    (BulkImportReport<PTRecordDraft> & { success: true }) | { success: false; error: string }
> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };

    const guard = await requirePermission('crm_professional_tax', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!input.csv?.trim()) return { success: false, error: 'CSV body is required.' };

    const ctx: BulkImportContext = { userId: String(session.user._id) };
    const report = await runBulkImport({
        csv: input.csv,
        adapter: PT_ADAPTER,
        ctx,
        dryRun: input.dryRun,
        dedup: input.dedup,
        maxRows: input.maxRows,
    });

    if (!report.dryRun && report.imported > 0) {
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'professional_tax_record',
                entityId: report.insertedIds[0] ?? '',
                reason: `bulk_import:${report.imported}/${report.total}`,
            });
        } catch { /* ignored */ }
        revalidatePath('/dashboard/hrm/payroll/professional-tax');
    }

    return { success: true, ...report };
}
