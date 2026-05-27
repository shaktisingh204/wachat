'use server';

/**
 * CRM HR TDS — Mongo-backed server actions.
 *
 * Per-employee quarterly TDS records. Collection: `crm_tds_records`.
 *   - employeeId, employeeName
 *   - financialYear ("2025-26"), quarter ('Q1'|'Q2'|'Q3'|'Q4')
 *   - tdsAmount, grossAmount
 *   - certificateNumber, depositDate (Date), depositChallanNumber
 *   - status: 'pending' | 'deposited' | 'filed' | 'archived'
 *   - notes
 *
 * Exposes `getTdsRecordsByEmployeeFY` for the per-employee + FY drill view.
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
    crmTdsApi,
    type CrmTdsCreateInput,
    type CrmTdsUpdateInput,
} from '@/lib/rust-client/crm-tds';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ─────────────────────────────────────────────────────────── */

type CrmTdsStatus = 'pending' | 'deposited' | 'filed' | 'archived';
type CrmTdsQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

interface CrmTdsListFilters {
    q?: string;
    status?: CrmTdsStatus | 'all';
    financialYear?: string;
    quarter?: CrmTdsQuarter;
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

const VALID_STATUSES = new Set<CrmTdsStatus>([
    'pending',
    'deposited',
    'filed',
    'archived',
]);
const VALID_QUARTERS = new Set<CrmTdsQuarter>(['Q1', 'Q2', 'Q3', 'Q4']);

/* ─── Reads ─────────────────────────────────────────────────────────── */

export async function getTdsRecords(
    filters?: CrmTdsListFilters,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const empty = { items: [], total: 0 };
    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_tds', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmTdsApi.list({
                q: filters?.q,
                status: filters?.status,
                financialYear: filters?.financialYear,
                quarter: filters?.quarter,
                employeeId: filters?.employeeId,
                limit: filters?.limit,
            });
            const items = res.items ?? [];
            return {
                items: JSON.parse(JSON.stringify(items)),
                total: items.length,
            };
        } catch (e) {
            console.error('[getTdsRecords] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'tds_record',
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
        if (filters?.financialYear) filter.financialYear = filters.financialYear;
        if (filters?.quarter) filter.quarter = filters.quarter;
        if (filters?.employeeId) filter.employeeId = filters.employeeId;
        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [
                { employeeName: re },
                { certificateNumber: re },
                { depositChallanNumber: re },
                { financialYear: re },
            ];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
        const cursor = db
            .collection('crm_tds_records')
            .find(filter)
            .sort({ financialYear: -1, quarter: 1, _id: -1 })
            .limit(limit);

        const docs = await cursor.toArray();
        const total = await db
            .collection('crm_tds_records')
            .countDocuments(filter);
        return { items: JSON.parse(JSON.stringify(docs)), total };
    } catch (e) {
        console.error('[getTdsRecords] failed:', e);
        return empty;
    }
}

export async function getTdsRecordById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_tds', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmTdsApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as WithId<
                Record<string, unknown>
            >;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) return null;
            console.error('[getTdsRecordById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'tds_record',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_tds_records').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getTdsRecordById] failed:', e);
        return null;
    }
}

/**
 * Per-employee + FY view — returns the four quarterly rows in order.
 *
 * Useful for the drill-through "TDS by employee" view.
 */
export async function getTdsRecordsByEmployeeFY(
    employeeId: string,
    financialYear: string,
): Promise<Array<Record<string, unknown>>> {
    const session = await getSession();
    if (!session?.user) return [];
    if (!employeeId || !financialYear) return [];

    const guard = await requirePermission('crm_tds', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmTdsApi.list({
                employeeId,
                financialYear,
                limit: 100,
            });
            return JSON.parse(JSON.stringify(res.items ?? []));
        } catch (e) {
            console.error(
                '[getTdsRecordsByEmployeeFY] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'tds_record',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const docs = await db
            .collection('crm_tds_records')
            .find({
                userId: new ObjectId(session.user._id as string),
                employeeId,
                financialYear,
                status: { $ne: 'archived' },
            })
            .sort({ quarter: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(docs));
    } catch (e) {
        console.error('[getTdsRecordsByEmployeeFY] failed:', e);
        return [];
    }
}

/* ─── Writes ────────────────────────────────────────────────────────── */

export async function saveTdsRecord(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const recordId = asString(formData.get('recordId'));
    const isEditing = !!recordId;

    const guard = await requirePermission(
        'crm_tds',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeName = asString(formData.get('employeeName'));
    if (!employeeName) return { error: 'Employee name is required.' };

    const financialYear = asString(formData.get('financialYear'));
    if (!financialYear) return { error: 'Financial year is required.' };

    const quarterRaw = asString(formData.get('quarter'));
    if (!quarterRaw || !VALID_QUARTERS.has(quarterRaw as CrmTdsQuarter)) {
        return { error: 'Quarter must be Q1, Q2, Q3 or Q4.' };
    }
    const quarter = quarterRaw as CrmTdsQuarter;

    const statusRaw = asString(formData.get('status'));
    const status: CrmTdsStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmTdsStatus)
            ? (statusRaw as CrmTdsStatus)
            : 'pending';

    const employeeId = asString(formData.get('employeeId'));
    const tdsAmount = asNumber(formData.get('tdsAmount')) ?? 0;
    const grossAmount = asNumber(formData.get('grossAmount')) ?? 0;
    const certificateNumber = asString(formData.get('certificateNumber'));
    const depositChallanNumber = asString(formData.get('depositChallanNumber'));
    const depositDateRaw = asString(formData.get('depositDate'));
    const depositDate =
        depositDateRaw ? new Date(depositDateRaw) : undefined;
    const notes = asString(formData.get('notes'));

    if (useRustCrm()) {
        try {
            if (isEditing) {
                if (!ObjectId.isValid(recordId!)) {
                    return { error: 'Invalid TDS record id.' };
                }
                const patch: CrmTdsUpdateInput = {
                    employeeName,
                    ...(employeeId !== undefined ? { employeeId } : {}),
                    financialYear,
                    quarter,
                    tdsAmount,
                    grossAmount,
                    ...(certificateNumber !== undefined
                        ? { certificateNumber }
                        : {}),
                    ...(depositChallanNumber !== undefined
                        ? { depositChallanNumber }
                        : {}),
                    ...(depositDate && !Number.isNaN(depositDate.getTime())
                        ? { depositDate: depositDate.toISOString() }
                        : {}),
                    status,
                    ...(notes !== undefined ? { notes } : {}),
                };
                await crmTdsApi.update(recordId!, patch);

                try {
                    await writeAuditEntry({
                        tenantUserId: String(session.user._id),
                        actorId: String(session.user._id),
                        action: 'update',
                        entityKind: 'tds_record',
                        entityId: recordId!,
                    });
                } catch {
                    /* non-fatal */
                }

                revalidatePath('/dashboard/hrm/payroll/tds');
                revalidatePath(`/dashboard/hrm/payroll/tds/${recordId}`);
                return { message: 'TDS record updated.', id: recordId };
            }

            const input: CrmTdsCreateInput = {
                ...(employeeId ? { employeeId } : {}),
                employeeName,
                financialYear,
                quarter,
                tdsAmount,
                grossAmount,
                ...(certificateNumber ? { certificateNumber } : {}),
                ...(depositChallanNumber ? { depositChallanNumber } : {}),
                ...(depositDate && !Number.isNaN(depositDate.getTime())
                    ? { depositDate: depositDate.toISOString() }
                    : {}),
                status,
                ...(notes ? { notes } : {}),
            };
            const created = await crmTdsApi.create(input);

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'tds_record',
                    entityId: created.id,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/hrm/payroll/tds');
            return { message: 'TDS record created.', id: created.id };
        } catch (e) {
            console.error('[saveTdsRecord] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'tds_record',
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
                return { error: 'Invalid TDS record id.' };
            }
            const existing = await db.collection('crm_tds_records').findOne({
                _id: new ObjectId(recordId!),
                userId: userObjectId,
            });
            if (!existing) return { error: 'TDS record not found.' };

            const $set: Record<string, unknown> = {
                employeeName,
                ...(employeeId !== undefined ? { employeeId } : {}),
                financialYear,
                quarter,
                tdsAmount,
                grossAmount,
                ...(certificateNumber
                    ? { certificateNumber }
                    : { certificateNumber: null }),
                ...(depositChallanNumber
                    ? { depositChallanNumber }
                    : { depositChallanNumber: null }),
                ...(depositDate && !Number.isNaN(depositDate.getTime())
                    ? { depositDate }
                    : { depositDate: null }),
                status,
                ...(notes !== undefined ? { notes } : {}),
                updatedAt: now,
            };

            await db.collection('crm_tds_records').updateOne(
                { _id: new ObjectId(recordId!), userId: userObjectId },
                { $set },
            );

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'tds_record',
                    entityId: recordId!,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/hrm/payroll/tds');
            revalidatePath(`/dashboard/hrm/payroll/tds/${recordId}`);
            return { message: 'TDS record updated.', id: recordId };
        }

        const doc: Record<string, unknown> = {
            userId: userObjectId,
            employeeName,
            ...(employeeId ? { employeeId } : {}),
            financialYear,
            quarter,
            tdsAmount,
            grossAmount,
            ...(certificateNumber ? { certificateNumber } : {}),
            ...(depositChallanNumber ? { depositChallanNumber } : {}),
            ...(depositDate && !Number.isNaN(depositDate.getTime())
                ? { depositDate }
                : {}),
            status,
            ...(notes ? { notes } : {}),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection('crm_tds_records').insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'tds_record',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/tds');
        return {
            message: 'TDS record created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save TDS record: ${getErrorMessage(e)}` };
    }
}

export async function deleteTdsRecord(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid TDS record id.' };
    }

    const guard = await requirePermission('crm_tds', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmTdsApi.delete(id);
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'delete',
                    entityKind: 'tds_record',
                    entityId: id,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/hrm/payroll/tds');
            return { success: true };
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) {
                return { success: false, error: 'TDS record not found.' };
            }
            console.error('[deleteTdsRecord] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'tds_record',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_tds_records').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'TDS record not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'tds_record',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/tds');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
