'use server';

/**
 * CRM Travel Requests server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/travel` on the Rust BFF; otherwise legacy direct-Mongo
 * runs. Failures record via `recordRustFallback` and fall through to the
 * legacy path.
 *
 * Tracks employee business-trip requests against the `crm_travel_requests`
 * collection (snake_case fields). Each request is scoped by tenant `userId`
 * and carries `employee_id`/`approver_id` as string references.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmTravelApi } from '@/lib/rust-client/crm-travel';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const COLLECTION = 'crm_travel_requests';
const BASE_PATH = '/dashboard/hrm/hr/travel';
const RBAC_KEY = 'crm_travel';
const ENTITY_KIND = 'travel_request';

type CrmTravelStatus =
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'completed'
    | 'archived';

type CrmTravelMode =
    | 'flight'
    | 'train'
    | 'bus'
    | 'car'
    | 'taxi'
    | 'other';

interface CrmTravelRequestDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    purpose?: string;
    from_city?: string;
    to_city?: string;
    mode?: CrmTravelMode | string;
    travel_date?: string;
    return_date?: string | null;
    estimated_cost?: number;
    actual_cost?: number;
    currency?: string;
    status: CrmTravelStatus;
    approver_id?: string;
    approver_name?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmTravelFilters {
    q?: string;
    status?: CrmTravelStatus | 'all';
    employeeId?: string;
    approverId?: string;
}

const VALID_STATUSES: ReadonlySet<CrmTravelStatus> =
    new Set<CrmTravelStatus>([
        'draft',
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'completed',
        'archived',
    ]);

const VALID_MODES: ReadonlySet<CrmTravelMode> = new Set<CrmTravelMode>([
    'flight',
    'train',
    'bus',
    'car',
    'taxi',
    'other',
]);

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

function serialize<T extends WithId<Record<string, unknown>>>(doc: T): CrmTravelRequestDoc {
    return JSON.parse(JSON.stringify(doc)) as CrmTravelRequestDoc;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getTravelRequests(
    filters?: CrmTravelFilters,
): Promise<CrmTravelRequestDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmTravelApi.list({
                q: filters?.q,
                status: filters?.status,
                employeeId: filters?.employeeId,
                approverId: filters?.approverId,
            });
            return JSON.parse(
                JSON.stringify(res.items ?? []),
            ) as CrmTravelRequestDoc[];
        } catch (e) {
            console.error(
                '[getTravelRequests] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'travel_request',
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

        if (filters?.status && filters.status !== 'all') filter.status = filters.status;
        if (filters?.employeeId) filter.employee_id = filters.employeeId;
        if (filters?.approverId) filter.approver_id = filters.approverId;

        if (filters?.q) {
            const rx = new RegExp(filters.q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
            filter.$or = [
                { employee_name: { $regex: rx } },
                { employee_id: { $regex: rx } },
                { purpose: { $regex: rx } },
                { from_city: { $regex: rx } },
                { to_city: { $regex: rx } },
            ];
        }

        const rows = await db
            .collection(COLLECTION)
            .find(filter)
            .sort({ travel_date: -1, createdAt: -1 })
            .limit(200)
            .toArray();

        return rows.map((r) => serialize(r as WithId<Record<string, unknown>>));
    } catch (e) {
        console.error('[getTravelRequests] failed:', e);
        return [];
    }
}

export async function getTravelRequestById(
    id: string,
): Promise<CrmTravelRequestDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmTravelApi.getById(id);
            return JSON.parse(
                JSON.stringify(doc),
            ) as CrmTravelRequestDoc;
        } catch (e) {
            console.error(
                '[getTravelRequestById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'travel_request',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return serialize(doc as WithId<Record<string, unknown>>);
    } catch (e) {
        console.error('[getTravelRequestById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

interface TravelPayload {
    employee_id: string;
    employee_name?: string;
    purpose?: string;
    from_city?: string;
    to_city?: string;
    mode?: CrmTravelMode;
    travel_date?: Date;
    return_date?: Date | null;
    estimated_cost?: number;
    actual_cost?: number;
    currency?: string;
    status: CrmTravelStatus;
    approver_id?: string;
    approver_name?: string;
    notes?: string;
}

function readPayload(formData: FormData): {
    payload?: TravelPayload;
    error?: string;
} {
    const employee_id = asString(formData.get('employee_id'));
    if (!employee_id) return { error: 'Employee is required.' };

    const statusRaw = asString(formData.get('status')) ?? 'pending';
    const status: CrmTravelStatus = VALID_STATUSES.has(statusRaw as CrmTravelStatus)
        ? (statusRaw as CrmTravelStatus)
        : 'pending';

    const modeRaw = asString(formData.get('mode'));
    const mode: CrmTravelMode | undefined =
        modeRaw && VALID_MODES.has(modeRaw as CrmTravelMode)
            ? (modeRaw as CrmTravelMode)
            : undefined;

    const travelDateStr = asString(formData.get('travel_date'));
    const returnDateStr = asString(formData.get('return_date'));

    const payload: TravelPayload = {
        employee_id,
        employee_name: asString(formData.get('employee_name')),
        purpose: asString(formData.get('purpose')),
        from_city: asString(formData.get('from_city')),
        to_city: asString(formData.get('to_city')),
        ...(mode ? { mode } : {}),
        ...(travelDateStr ? { travel_date: new Date(travelDateStr) } : {}),
        ...(returnDateStr
            ? { return_date: new Date(returnDateStr) }
            : { return_date: null }),
        estimated_cost: asNumber(formData.get('estimated_cost')),
        actual_cost: asNumber(formData.get('actual_cost')),
        currency: asString(formData.get('currency')) ?? 'INR',
        status,
        approver_id: asString(formData.get('approver_id')),
        approver_name: asString(formData.get('approver_name')),
        notes: asString(formData.get('notes')),
    };

    return { payload };
}

export async function saveTravelRequest(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const travelId = asString(formData.get('travelId'));
    const isEditing = !!travelId;

    const guard = await requirePermission(RBAC_KEY, isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error || !payload) return { error: error ?? 'Invalid payload.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing && ObjectId.isValid(travelId!)) {
            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(travelId!), userId: userObjectId },
                { $set: { ...payload, updatedAt: now } },
            );
            if (result.matchedCount === 0) return { error: 'Travel request not found.' };

            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'update',
                entityKind: ENTITY_KIND,
                entityId: travelId!,
                reason: `Travel request status=${payload.status}`,
            });
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${travelId}`);
            return { message: 'Travel request updated.', id: travelId! };
        }

        const inserted = await db.collection(COLLECTION).insertOne({
            ...payload,
            userId: userObjectId,
            createdAt: now,
            updatedAt: now,
        });
        const id = inserted.insertedId.toString();

        void writeAuditEntry({
            tenantUserId: session.user._id as string,
            action: 'create',
            entityKind: ENTITY_KIND,
            entityId: id,
            reason: `Travel request for employee ${payload.employee_id}`,
        });

        revalidatePath(BASE_PATH);
        return { message: 'Travel request created.', id };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveTravelRequest] failed:', msg);
        return { error: `Failed to save travel request: ${msg}` };
    }
}

export async function deleteTravelRequest(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission(RBAC_KEY, 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (result.deletedCount > 0) {
            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'delete',
                entityKind: ENTITY_KIND,
                entityId: id,
            });
        }
        revalidatePath(BASE_PATH);
        return { success: result.deletedCount > 0 };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteTravelRequest] failed:', msg);
        return { success: false, error: msg };
    }
}
