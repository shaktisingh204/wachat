'use server';

/**
 * CRM HR PF/ESI — Mongo-backed server actions.
 *
 * Monthly per-employee PF + ESI records. Collection: `crm_pf_esi_records`.
 *   - employeeId, employeeName
 *   - month ("YYYY-MM")
 *   - pfEmployer, pfEmployee, pfUan
 *   - esiEmployer, esiEmployee, esiIcNumber
 *   - depositDate (Date), challanNumber
 *   - status: 'pending' | 'deposited' | 'filed' | 'archived'
 *   - notes
 *
 * Also exposes `bulkImportPfEsiFromPayrollRun` which builds drafts from
 * an existing payroll run keyed by month.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmPfEsiApi,
    type CrmPfEsiCreateInput,
    type CrmPfEsiUpdateInput,
} from '@/lib/rust-client/crm-pf-esi';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ─────────────────────────────────────────────────────────── */

export type CrmPfEsiStatus = 'pending' | 'deposited' | 'filed' | 'archived';

export interface CrmPfEsiListFilters {
    q?: string;
    status?: CrmPfEsiStatus | 'all';
    month?: string; // YYYY-MM
    employeeId?: string;
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

const VALID_STATUSES = new Set<CrmPfEsiStatus>([
    'pending',
    'deposited',
    'filed',
    'archived',
]);

/* ─── Reads ─────────────────────────────────────────────────────────── */

export async function getPfEsiRecords(
    filters?: CrmPfEsiListFilters,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const empty = { items: [], total: 0 };
    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_pf_esi', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmPfEsiApi.list({
                q: filters?.q,
                status: filters?.status,
                month:
                    filters?.month && isValidMonth(filters.month)
                        ? filters.month
                        : undefined,
                employeeId: filters?.employeeId,
                limit: filters?.limit,
            });
            const items = res.items ?? [];
            return {
                items: JSON.parse(JSON.stringify(items)),
                total: items.length,
            };
        } catch (e) {
            console.error('[getPfEsiRecords] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pf_esi_record',
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
        if (filters?.month && isValidMonth(filters.month)) {
            filter.month = filters.month;
        }
        if (filters?.employeeId) {
            filter.employeeId = filters.employeeId;
        }
        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [
                { employeeName: re },
                { pfUan: re },
                { esiIcNumber: re },
                { challanNumber: re },
                { month: re },
            ];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
        const cursor = db
            .collection('crm_pf_esi_records')
            .find(filter)
            .sort({ month: -1, _id: -1 })
            .limit(limit);

        const docs = await cursor.toArray();
        const total = await db
            .collection('crm_pf_esi_records')
            .countDocuments(filter);
        return { items: JSON.parse(JSON.stringify(docs)), total };
    } catch (e) {
        console.error('[getPfEsiRecords] failed:', e);
        return empty;
    }
}

export async function getPfEsiRecordById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_pf_esi', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmPfEsiApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as WithId<
                Record<string, unknown>
            >;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getPfEsiRecordById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pf_esi_record',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_pf_esi_records').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getPfEsiRecordById] failed:', e);
        return null;
    }
}

/* ─── Writes ────────────────────────────────────────────────────────── */

export async function savePfEsiRecord(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const recordId = asString(formData.get('recordId'));
    const isEditing = !!recordId;

    const guard = await requirePermission(
        'crm_pf_esi',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeName = asString(formData.get('employeeName'));
    if (!employeeName) return { error: 'Employee name is required.' };

    const month = asString(formData.get('month'));
    if (!month || !isValidMonth(month)) {
        return { error: 'Month must be in YYYY-MM format.' };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmPfEsiStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmPfEsiStatus)
            ? (statusRaw as CrmPfEsiStatus)
            : 'pending';

    const employeeId = asString(formData.get('employeeId'));
    const pfEmployer = asNumber(formData.get('pfEmployer')) ?? 0;
    const pfEmployee = asNumber(formData.get('pfEmployee')) ?? 0;
    const pfUan = asString(formData.get('pfUan'));
    const esiEmployer = asNumber(formData.get('esiEmployer')) ?? 0;
    const esiEmployee = asNumber(formData.get('esiEmployee')) ?? 0;
    const esiIcNumber = asString(formData.get('esiIcNumber'));
    const challanNumber = asString(formData.get('challanNumber'));
    const depositDateRaw = asString(formData.get('depositDate'));
    const depositDate = depositDateRaw ? new Date(depositDateRaw) : undefined;
    const documentUrl = asString(formData.get('documentUrl'));
    const notes = asString(formData.get('notes'));

    if (useRustCrm()) {
        try {
            if (isEditing) {
                if (!ObjectId.isValid(recordId!)) {
                    return { error: 'Invalid PF/ESI record id.' };
                }
                const patch: CrmPfEsiUpdateInput = {
                    employeeName,
                    ...(employeeId !== undefined ? { employeeId } : {}),
                    month,
                    pfEmployer,
                    pfEmployee,
                    ...(pfUan !== undefined ? { pfUan } : {}),
                    esiEmployer,
                    esiEmployee,
                    ...(esiIcNumber !== undefined ? { esiIcNumber } : {}),
                    ...(challanNumber !== undefined ? { challanNumber } : {}),
                    ...(depositDate && !Number.isNaN(depositDate.getTime())
                        ? { depositDate: depositDate.toISOString() }
                        : {}),
                    ...(documentUrl !== undefined ? { documentUrl } : {}),
                    status,
                    ...(notes !== undefined ? { notes } : {}),
                };
                await crmPfEsiApi.update(recordId!, patch);

                try {
                    await writeAuditEntry({
                        tenantUserId: String(session.user._id),
                        actorId: String(session.user._id),
                        action: 'update',
                        entityKind: 'pf_esi_record',
                        entityId: recordId!,
                    });
                } catch {
                    /* non-fatal */
                }

                revalidatePath('/dashboard/hrm/payroll/pf-esi');
                revalidatePath(`/dashboard/hrm/payroll/pf-esi/${recordId}`);
                return { message: 'PF/ESI record updated.', id: recordId };
            }

            const input: CrmPfEsiCreateInput = {
                ...(employeeId ? { employeeId } : {}),
                employeeName,
                month,
                pfEmployer,
                pfEmployee,
                ...(pfUan ? { pfUan } : {}),
                esiEmployer,
                esiEmployee,
                ...(esiIcNumber ? { esiIcNumber } : {}),
                ...(challanNumber ? { challanNumber } : {}),
                ...(depositDate && !Number.isNaN(depositDate.getTime())
                    ? { depositDate: depositDate.toISOString() }
                    : {}),
                ...(documentUrl ? { documentUrl } : {}),
                status,
                ...(notes ? { notes } : {}),
            };
            const created = await crmPfEsiApi.create(input);

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'pf_esi_record',
                    entityId: created.id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/hrm/payroll/pf-esi');
            return { message: 'PF/ESI record created.', id: created.id };
        } catch (e) {
            console.error('[savePfEsiRecord] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pf_esi_record',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing) {
            if (!ObjectId.isValid(recordId!)) {
                return { error: 'Invalid PF/ESI record id.' };
            }
            const existing = await db.collection('crm_pf_esi_records').findOne({
                _id: new ObjectId(recordId!),
                userId: userObjectId,
            });
            if (!existing) return { error: 'PF/ESI record not found.' };

            const $set: Record<string, unknown> = {
                employeeName,
                ...(employeeId !== undefined ? { employeeId } : {}),
                month,
                pfEmployer,
                pfEmployee,
                ...(pfUan ? { pfUan } : { pfUan: null }),
                esiEmployer,
                esiEmployee,
                ...(esiIcNumber ? { esiIcNumber } : { esiIcNumber: null }),
                ...(challanNumber ? { challanNumber } : { challanNumber: null }),
                ...(depositDate && !Number.isNaN(depositDate.getTime())
                    ? { depositDate }
                    : { depositDate: null }),
                ...(documentUrl ? { documentUrl } : { documentUrl: null }),
                status,
                ...(notes !== undefined ? { notes } : {}),
                updatedAt: now,
            };

            await db.collection('crm_pf_esi_records').updateOne(
                { _id: new ObjectId(recordId!), userId: userObjectId },
                { $set },
            );

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'pf_esi_record',
                    entityId: recordId!,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/hrm/payroll/pf-esi');
            revalidatePath(`/dashboard/hrm/payroll/pf-esi/${recordId}`);
            return { message: 'PF/ESI record updated.', id: recordId };
        }

        const doc: Record<string, unknown> = {
            userId: userObjectId,
            employeeName,
            ...(employeeId ? { employeeId } : {}),
            month,
            pfEmployer,
            pfEmployee,
            ...(pfUan ? { pfUan } : {}),
            esiEmployer,
            esiEmployee,
            ...(esiIcNumber ? { esiIcNumber } : {}),
            ...(challanNumber ? { challanNumber } : {}),
            ...(depositDate && !Number.isNaN(depositDate.getTime())
                ? { depositDate }
                : {}),
            ...(documentUrl ? { documentUrl } : {}),
            status,
            ...(notes ? { notes } : {}),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection('crm_pf_esi_records').insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'pf_esi_record',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/pf-esi');
        return {
            message: 'PF/ESI record created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save PF/ESI record: ${getErrorMessage(e)}` };
    }
}

export async function deletePfEsiRecord(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid PF/ESI record id.' };
    }

    const guard = await requirePermission('crm_pf_esi', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmPfEsiApi.delete(id);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'pf_esi_record',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/hrm/payroll/pf-esi');
            return { success: true };
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { success: false, error: 'PF/ESI record not found.' };
            }
            console.error('[deletePfEsiRecord] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pf_esi_record',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_pf_esi_records').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'PF/ESI record not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'pf_esi_record',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/pf-esi');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Bulk-import PF/ESI rows from the payslips collection for a given month.
 *
 * For each payslip whose period falls in `month` (YYYY-MM), creates a
 * draft `crm_pf_esi_records` row carrying the PF/ESI deductions found in
 * the slip — unless a row already exists for that employee + month.
 */
export async function bulkImportPfEsiFromPayrollRun(
    month: string,
): Promise<{ created: number; skipped: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { created: 0, skipped: 0, error: 'Access denied.' };
    }
    if (!isValidMonth(month)) {
        return { created: 0, skipped: 0, error: 'Month must be in YYYY-MM format.' };
    }

    const guard = await requirePermission('crm_pf_esi', 'create');
    if (!guard.ok) return { created: 0, skipped: 0, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);

        const [year, monthIdx] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, monthIdx - 1, 1));
        const end = new Date(Date.UTC(year, monthIdx, 1));

        const payslips = await db
            .collection('crm_payslips')
            .find({
                userId: userObjectId,
                period: { $gte: start, $lt: end },
            })
            .limit(2000)
            .toArray();

        let created = 0;
        let skipped = 0;
        const now = new Date();

        for (const slip of payslips) {
            const empIdStr = slip.employeeId ? String(slip.employeeId) : '';
            if (!empIdStr) continue;

            const existing = await db.collection('crm_pf_esi_records').findOne({
                userId: userObjectId,
                employeeId: empIdStr,
                month,
            });
            if (existing) {
                skipped += 1;
                continue;
            }

            const deductions: Array<{ name?: string; amount?: number }> =
                Array.isArray(slip.deductions) ? slip.deductions : [];
            const pfEmployee = deductions
                .filter((d) =>
                    /pf|provident/i.test(String(d?.name ?? '')),
                )
                .reduce((s, d) => s + (Number(d?.amount) || 0), 0);
            const esiEmployee = deductions
                .filter((d) => /esi/i.test(String(d?.name ?? '')))
                .reduce((s, d) => s + (Number(d?.amount) || 0), 0);

            const employeeName =
                slip.employeeName ||
                [slip.firstName, slip.lastName].filter(Boolean).join(' ') ||
                'Employee';

            await db.collection('crm_pf_esi_records').insertOne({
                userId: userObjectId,
                employeeId: empIdStr,
                employeeName,
                month,
                pfEmployer: 0,
                pfEmployee,
                ...(slip.pfUan ? { pfUan: String(slip.pfUan) } : {}),
                esiEmployer: 0,
                esiEmployee,
                ...(slip.esiNumber ? { esiIcNumber: String(slip.esiNumber) } : {}),
                status: 'pending',
                createdAt: now,
                updatedAt: now,
            });
            created += 1;
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'pf_esi_record',
                entityId: `bulk:${month}`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/pf-esi');
        return { created, skipped };
    } catch (e) {
        return { created: 0, skipped: 0, error: getErrorMessage(e) };
    }
}

export async function getLatestPfEsiRecord(
    employeeId: string,
): Promise<Record<string, unknown> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!employeeId) return null;

    const guard = await requirePermission('crm_pf_esi', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const res = await crmPfEsiApi.list({ employeeId, limit: 1 });
            if (res.items && res.items.length > 0) {
                return JSON.parse(JSON.stringify(res.items[0]));
            }
            return null;
        } catch (e) {
            console.error('[getLatestPfEsiRecord] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'pf_esi_record',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const doc = await db.collection('crm_pf_esi_records').findOne(
            { userId: userObjectId, employeeId },
            { sort: { month: -1, _id: -1 } },
        );
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        return null;
    }
}
