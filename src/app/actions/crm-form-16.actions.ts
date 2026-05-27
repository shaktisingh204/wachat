'use server';

/**
 * CRM HR Form 16 — server actions with dual implementation.
 *
 * When `USE_RUST_CRM === 'true'` reads/writes route through the Rust BFF
 * `/v1/crm/form-16`; otherwise the legacy direct-Mongo path runs. Failures
 * record via `recordRustFallback` and fall through to the legacy path.
 *
 * Note: `bulkGenerateForm16` joins `crm_employees` and is NOT part of the
 * Rust crate. It stays on the Mongo path unconditionally.
 *
 * Field shape on `crm_form_16`:
 *   - employeeId, employeeName
 *   - financialYear   (e.g. "2025-26")
 *   - pan, tanOfEmployer
 *   - totalIncome, taxDeducted        (numbers)
 *   - generatedAt (Date), generatedBy (userId string)
 *   - documentUrl   (SabFile pick — generated/uploaded PDF)
 *   - status: 'draft' | 'generated' | 'issued' | 'archived'
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmForm16Api } from '@/lib/rust-client/crm-form-16';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ─────────────────────────────────────────────────────────── */

type CrmForm16Status = 'draft' | 'generated' | 'issued' | 'archived';

interface CrmForm16ListFilters {
    q?: string;
    status?: CrmForm16Status | 'all';
    financialYear?: string;
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

const VALID_STATUSES = new Set<CrmForm16Status>([
    'draft',
    'generated',
    'issued',
    'archived',
]);

/* ─── Reads ─────────────────────────────────────────────────────────── */

export async function getForm16Records(
    filters?: CrmForm16ListFilters,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
    const empty = { items: [], total: 0 };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_form_16', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmForm16Api.list({
                q: filters?.q,
                status: filters?.status,
                financialYear: filters?.financialYear,
                limit: filters?.limit,
            });
            const items = JSON.parse(JSON.stringify(res.items ?? []));
            return {
                items,
                total: (res.items ?? []).length,
            };
        } catch (e) {
            console.error(
                '[getForm16Records] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'form_16',
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
        if (filters?.financialYear) {
            filter.financialYear = filters.financialYear;
        }
        if (filters?.q) {
            const re = new RegExp(
                filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            filter.$or = [
                { employeeName: re },
                { pan: re },
                { tanOfEmployer: re },
                { financialYear: re },
            ];
        }

        const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
        const cursor = db
            .collection('crm_form_16')
            .find(filter)
            .sort({ generatedAt: -1, _id: -1 })
            .limit(limit);

        const docs = await cursor.toArray();
        const total = await db.collection('crm_form_16').countDocuments(filter);
        return { items: JSON.parse(JSON.stringify(docs)), total };
    } catch (e) {
        console.error('[getForm16Records] failed:', e);
        return empty;
    }
}

export async function getForm16ById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_form_16', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmForm16Api.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error(
                '[getForm16ById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'form_16',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_form_16').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getForm16ById] failed:', e);
        return null;
    }
}

/* ─── Writes ────────────────────────────────────────────────────────── */

export async function saveForm16(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const form16Id = asString(formData.get('form16Id'));
    const isEditing = !!form16Id;

    const guard = await requirePermission(
        'crm_form_16',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employeeName = asString(formData.get('employeeName'));
    if (!employeeName) return { error: 'Employee name is required.' };

    const financialYear = asString(formData.get('financialYear'));
    if (!financialYear) return { error: 'Financial year is required.' };

    const statusRaw = asString(formData.get('status'));
    const status: CrmForm16Status =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmForm16Status)
            ? (statusRaw as CrmForm16Status)
            : 'draft';

    const employeeId = asString(formData.get('employeeId'));
    const pan = asString(formData.get('pan'))?.toUpperCase();
    const tanOfEmployer = asString(formData.get('tanOfEmployer'))?.toUpperCase();
    const totalIncome = asNumber(formData.get('totalIncome')) ?? 0;
    const taxDeducted = asNumber(formData.get('taxDeducted')) ?? 0;
    const documentUrl = asString(formData.get('documentUrl'));

    if (useRustCrm()) {
        try {
            if (isEditing) {
                if (!ObjectId.isValid(form16Id!)) {
                    return { error: 'Invalid Form 16 id.' };
                }
                await crmForm16Api.update(form16Id!, {
                    employeeName,
                    ...(employeeId !== undefined ? { employeeId } : {}),
                    financialYear,
                    ...(pan ? { pan } : {}),
                    ...(tanOfEmployer ? { tanOfEmployer } : {}),
                    totalIncome,
                    taxDeducted,
                    ...(documentUrl ? { documentUrl } : {}),
                    status,
                });
                try {
                    await writeAuditEntry({
                        tenantUserId: String(session.user._id),
                        actorId: String(session.user._id),
                        action: 'update',
                        entityKind: 'form_16',
                        entityId: form16Id!,
                    });
                } catch {
                    /* non-fatal */
                }
                revalidatePath('/dashboard/hrm/payroll/form-16');
                revalidatePath(
                    `/dashboard/hrm/payroll/form-16/${form16Id}`,
                );
                return { message: 'Form 16 updated.', id: form16Id };
            }

            const created = await crmForm16Api.create({
                employeeName,
                ...(employeeId ? { employeeId } : {}),
                financialYear,
                ...(pan ? { pan } : {}),
                ...(tanOfEmployer ? { tanOfEmployer } : {}),
                totalIncome,
                taxDeducted,
                ...(documentUrl ? { documentUrl } : {}),
                status,
            });
            const newId = String(created.id ?? created.entity?._id ?? '');
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'form_16',
                    entityId: newId,
                });
            } catch {
                /* non-fatal */
            }
            revalidatePath('/dashboard/hrm/payroll/form-16');
            return { message: 'Form 16 record created.', id: newId };
        } catch (e) {
            console.error(
                '[saveForm16] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'form_16',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through to legacy Mongo path
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing) {
            if (!ObjectId.isValid(form16Id!)) {
                return { error: 'Invalid Form 16 id.' };
            }
            const existing = await db.collection('crm_form_16').findOne({
                _id: new ObjectId(form16Id!),
                userId: userObjectId,
            });
            if (!existing) return { error: 'Form 16 not found.' };

            const $set: Record<string, unknown> = {
                employeeName,
                ...(employeeId !== undefined ? { employeeId } : {}),
                financialYear,
                ...(pan ? { pan } : { pan: null }),
                ...(tanOfEmployer
                    ? { tanOfEmployer }
                    : { tanOfEmployer: null }),
                totalIncome,
                taxDeducted,
                ...(documentUrl ? { documentUrl } : { documentUrl: null }),
                status,
                updatedAt: now,
            };

            // Stamp generatedAt + generatedBy on first transition into
            // "generated"/"issued" if a document is attached.
            const prevStatus = existing.status as CrmForm16Status | undefined;
            if (
                (status === 'generated' || status === 'issued') &&
                prevStatus !== status &&
                !existing.generatedAt
            ) {
                $set.generatedAt = now;
                $set.generatedBy = String(session.user._id);
            }

            await db.collection('crm_form_16').updateOne(
                { _id: new ObjectId(form16Id!), userId: userObjectId },
                { $set },
            );

            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'form_16',
                    entityId: form16Id!,
                });
            } catch {
                /* non-fatal */
            }

            revalidatePath('/dashboard/hrm/payroll/form-16');
            revalidatePath(`/dashboard/hrm/payroll/form-16/${form16Id}`);
            return { message: 'Form 16 updated.', id: form16Id };
        }

        const doc: Record<string, unknown> = {
            userId: userObjectId,
            employeeName,
            ...(employeeId ? { employeeId } : {}),
            financialYear,
            ...(pan ? { pan } : {}),
            ...(tanOfEmployer ? { tanOfEmployer } : {}),
            totalIncome,
            taxDeducted,
            ...(documentUrl ? { documentUrl } : {}),
            status,
            ...(status === 'generated' || status === 'issued'
                ? { generatedAt: now, generatedBy: String(session.user._id) }
                : {}),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection('crm_form_16').insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'form_16',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/form-16');
        return {
            message: 'Form 16 record created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save Form 16: ${getErrorMessage(e)}` };
    }
}

export async function deleteForm16(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid Form 16 id.' };
    }

    const guard = await requirePermission('crm_form_16', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_form_16').updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Form 16 not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: 'form_16',
                entityId: id,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/form-16');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/**
 * Bulk-draft Form 16 rows for a given financial year + department.
 *
 * Creates one draft row per active employee in the department, skipping
 * any employee that already has a Form 16 for that FY. The PDF document
 * is attached later (per-row) via `<SabFilePickerButton>` in the form.
 */
export async function bulkGenerateForm16(
    financialYear: string,
    departmentId?: string,
): Promise<{ created: number; skipped: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { created: 0, skipped: 0, error: 'Access denied.' };
    if (!financialYear) {
        return { created: 0, skipped: 0, error: 'Financial year is required.' };
    }

    const guard = await requirePermission('crm_form_16', 'create');
    if (!guard.ok) return { created: 0, skipped: 0, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);

        const empFilter: Record<string, unknown> = { userId: userObjectId };
        if (departmentId) {
            empFilter.$or = [
                { departmentId },
                { departmentId: ObjectId.isValid(departmentId) ? new ObjectId(departmentId) : departmentId },
            ];
        }

        const employees = await db
            .collection('crm_employees')
            .find(empFilter)
            .limit(1000)
            .toArray();

        let created = 0;
        let skipped = 0;
        const now = new Date();

        for (const emp of employees) {
            const empIdStr = String(emp._id);
            const existing = await db.collection('crm_form_16').findOne({
                userId: userObjectId,
                employeeId: empIdStr,
                financialYear,
            });
            if (existing) {
                skipped += 1;
                continue;
            }

            const employeeName =
                [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() ||
                String(emp.email ?? 'Unnamed employee');

            await db.collection('crm_form_16').insertOne({
                userId: userObjectId,
                employeeId: empIdStr,
                employeeName,
                financialYear,
                ...(emp.pan ? { pan: String(emp.pan).toUpperCase() } : {}),
                totalIncome: 0,
                taxDeducted: 0,
                status: 'draft',
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
                entityKind: 'form_16',
                entityId: `bulk:${financialYear}:${departmentId ?? 'all'}`,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/hrm/payroll/form-16');
        return { created, skipped };
    } catch (e) {
        return { created: 0, skipped: 0, error: getErrorMessage(e) };
    }
}
