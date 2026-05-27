'use server';

/**
 * CRM Shift Change Requests — server actions with dual implementation.
 *
 * When `USE_RUST_CRM === 'true'` reads/writes route through the Rust BFF
 * `/v1/crm/shift-change-requests`; otherwise the legacy direct-Mongo path
 * runs. Failures record via `recordRustFallback` and fall through to the
 * legacy path.
 *
 * Employees submit a request to swap their `current_shift_id` for
 * `requested_shift_id` on a given `effective_date`; a manager / HR
 * approver can then approve or reject the request, recording an
 * `approver_id`, `approved_at`, and a short `response_notes`.
 *
 * Collection: `crm_shift_change_requests` (per-user-scoped, snake_case
 * BSON fields — preserved through the Rust crate as well).
 *
 * Shape:
 *   {
 *     _id, userId,
 *     employee_id, employee_name,
 *     current_shift_id, current_shift_name,
 *     requested_shift_id, requested_shift_name,
 *     effective_date, reason,
 *     status, approver_id?, approved_at?, response_notes?,
 *     createdAt, updatedAt,
 *   }
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmShiftChangeRequestsApi } from '@/lib/rust-client/crm-shift-change-requests';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const COLL = 'crm_shift_change_requests';
const LIST_PATH = '/dashboard/hrm/payroll/shift-change-requests';

type CrmShiftChangeStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled';

interface CrmShiftChangeRequest {
    _id?: ObjectId | string;
    userId?: ObjectId | string;
    employee_id?: string;
    employee_name?: string;
    current_shift_id?: string;
    current_shift_name?: string;
    requested_shift_id?: string;
    requested_shift_name?: string;
    effective_date?: Date | string;
    reason?: string;
    status: CrmShiftChangeStatus;
    approver_id?: string;
    approved_at?: Date | string | null;
    response_notes?: string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
}

type CrmShiftChangeRequestDoc = WithId<CrmShiftChangeRequest>;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

const VALID_STATUSES: ReadonlySet<CrmShiftChangeStatus> = new Set([
    'pending',
    'approved',
    'rejected',
    'cancelled',
]);

/* ─── Reads ──────────────────────────────────────────────────────────── */

interface ShiftChangeListParams {
    status?: CrmShiftChangeStatus | 'all';
    employeeId?: string;
    q?: string;
}

export async function getShiftChangeRequests(
    params: ShiftChangeListParams = {},
): Promise<CrmShiftChangeRequestDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_shift_change_request', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmShiftChangeRequestsApi.list({
                q: params.q,
                status: params.status,
                employee_id: params.employeeId,
            });
            return JSON.parse(
                JSON.stringify(res.items ?? []),
            ) as CrmShiftChangeRequestDoc[];
        } catch (e) {
            console.error(
                '[getShiftChangeRequests] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'shift_change_request',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId: new ObjectId(session.user._id as string),
        };
        if (params.status && params.status !== 'all') {
            filter.status = params.status;
        }
        if (params.employeeId) filter.employee_id = params.employeeId;
        if (params.q) {
            const rx = new RegExp(params.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [
                { employee_name: rx },
                { reason: rx },
                { current_shift_name: rx },
                { requested_shift_name: rx },
            ];
        }
        const rows = await db
            .collection<CrmShiftChangeRequest>(COLL)
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(500)
            .toArray();
        return JSON.parse(JSON.stringify(rows));
    } catch (e) {
        console.error('[getShiftChangeRequests] failed:', e);
        return [];
    }
}

export async function getShiftChangeRequestById(
    id: string,
): Promise<CrmShiftChangeRequestDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_shift_change_request', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmShiftChangeRequestsApi.getById(id);
            return JSON.parse(
                JSON.stringify(doc),
            ) as CrmShiftChangeRequestDoc;
        } catch (e) {
            console.error(
                '[getShiftChangeRequestById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'shift_change_request',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection<CrmShiftChangeRequest>(COLL).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('[getShiftChangeRequestById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveShiftChangeRequest(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const requestId = asString(formData.get('requestId'));
    const isEditing = !!requestId;

    const guard = await requirePermission(
        'crm_shift_change_request',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const employee_id = asString(formData.get('employee_id'));
    const employee_name = asString(formData.get('employee_name'));
    const current_shift_id = asString(formData.get('current_shift_id'));
    const current_shift_name = asString(formData.get('current_shift_name'));
    const requested_shift_id = asString(formData.get('requested_shift_id'));
    const requested_shift_name = asString(formData.get('requested_shift_name'));
    const effective_date_str = asString(formData.get('effective_date'));
    const reason = asString(formData.get('reason'));

    if (!employee_id) return { error: 'Employee is required.' };
    if (!current_shift_id) return { error: 'Current shift is required.' };
    if (!requested_shift_id) {
        return { error: 'Requested shift is required.' };
    }
    if (current_shift_id === requested_shift_id) {
        return {
            error: 'Requested shift must differ from current shift.',
        };
    }
    if (!effective_date_str) return { error: 'Effective date is required.' };

    const effective_date = new Date(effective_date_str);
    if (Number.isNaN(effective_date.getTime())) {
        return { error: 'Effective date is invalid.' };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmShiftChangeStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmShiftChangeStatus)
            ? (statusRaw as CrmShiftChangeStatus)
            : 'pending';

    if (useRustCrm()) {
        try {
            const effectiveIso = effective_date.toISOString();
            if (isEditing && ObjectId.isValid(requestId!)) {
                await crmShiftChangeRequestsApi.update(requestId!, {
                    employee_id,
                    ...(employee_name ? { employee_name } : {}),
                    current_shift_id,
                    ...(current_shift_name ? { current_shift_name } : {}),
                    requested_shift_id,
                    ...(requested_shift_name ? { requested_shift_name } : {}),
                    effective_date: effectiveIso,
                    ...(reason ? { reason } : {}),
                    status,
                });
                revalidatePath(LIST_PATH);
                return { message: 'Request updated.', id: requestId };
            }

            const created = await crmShiftChangeRequestsApi.create({
                employee_id: employee_id!,
                ...(employee_name ? { employee_name } : {}),
                current_shift_id: current_shift_id!,
                ...(current_shift_name ? { current_shift_name } : {}),
                requested_shift_id: requested_shift_id!,
                ...(requested_shift_name ? { requested_shift_name } : {}),
                effective_date: effectiveIso,
                ...(reason ? { reason } : {}),
                status,
            });
            const newId = String(created.id ?? created.entity?._id ?? '');
            revalidatePath(LIST_PATH);
            return { message: 'Request submitted.', id: newId };
        } catch (e) {
            console.error(
                '[saveShiftChangeRequest] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'shift_change_request',
                op: isEditing ? 'update' : 'create',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through to legacy Mongo path
        }
    }

    try {
        const { db } = await connectToDatabase();
        const now = new Date();

        if (isEditing && ObjectId.isValid(requestId!)) {
            const $set: Record<string, unknown> = {
                employee_id,
                employee_name,
                current_shift_id,
                current_shift_name,
                requested_shift_id,
                requested_shift_name,
                effective_date,
                reason,
                status,
                updatedAt: now,
            };
            await db.collection(COLL).updateOne(
                {
                    _id: new ObjectId(requestId!),
                    userId: new ObjectId(session.user._id as string),
                },
                { $set },
            );
            revalidatePath(LIST_PATH);
            return { message: 'Request updated.', id: requestId };
        }

        const doc: CrmShiftChangeRequest = {
            userId: new ObjectId(session.user._id as string),
            employee_id,
            employee_name,
            current_shift_id,
            current_shift_name,
            requested_shift_id,
            requested_shift_name,
            effective_date,
            reason,
            status,
            createdAt: now,
            updatedAt: now,
        };
        const res = await db.collection(COLL).insertOne(doc);
        revalidatePath(LIST_PATH);
        return {
            message: 'Request submitted.',
            id: res.insertedId.toString(),
        };
    } catch (e) {
        return { error: `Failed to save request: ${getErrorMessage(e)}` };
    }
}

export async function approveShiftChangeRequest(
    id: string,
    response_notes?: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_shift_change_request', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmShiftChangeRequestsApi.update(id, {
                status: 'approved',
                approver_id: String(session.user._id),
                response_notes: response_notes ?? '',
            });
            revalidatePath(LIST_PATH);
            return { success: true };
        } catch (e) {
            console.error(
                '[approveShiftChangeRequest] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'shift_change_request',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            {
                $set: {
                    status: 'approved' as CrmShiftChangeStatus,
                    approver_id: String(session.user._id),
                    approved_at: new Date(),
                    response_notes: response_notes ?? '',
                    updatedAt: new Date(),
                },
            },
        );
        revalidatePath(LIST_PATH);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function rejectShiftChangeRequest(
    id: string,
    response_notes?: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_shift_change_request', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmShiftChangeRequestsApi.update(id, {
                status: 'rejected',
                approver_id: String(session.user._id),
                response_notes: response_notes ?? '',
            });
            revalidatePath(LIST_PATH);
            return { success: true };
        } catch (e) {
            console.error(
                '[rejectShiftChangeRequest] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'shift_change_request',
                op: 'update',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).updateOne(
            {
                _id: new ObjectId(id),
                userId: new ObjectId(session.user._id as string),
            },
            {
                $set: {
                    status: 'rejected' as CrmShiftChangeStatus,
                    approver_id: String(session.user._id),
                    approved_at: new Date(),
                    response_notes: response_notes ?? '',
                    updatedAt: new Date(),
                },
            },
        );
        revalidatePath(LIST_PATH);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteShiftChangeRequest(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_shift_change_request', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (useRustCrm()) {
        try {
            await crmShiftChangeRequestsApi.delete(id);
            revalidatePath(LIST_PATH);
            return { success: true };
        } catch (e) {
            console.error(
                '[deleteShiftChangeRequest] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'shift_change_request',
                op: 'delete',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection(COLL).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        revalidatePath(LIST_PATH);
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
