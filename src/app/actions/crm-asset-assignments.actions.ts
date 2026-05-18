'use server';

/**
 * CRM Asset Assignments — Mongo-backed (no Rust crate).
 *
 * Tracks issue/return events between assets and employees against the
 * `crm_asset_assignments` collection. Each assignment is scoped by tenant
 * `userId` and keeps `asset_id` / `employee_id` as string references
 * (not ObjectIds — assets live in the Rust crate and use string `_id`).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmAssetAssignmentsApi } from '@/lib/rust-client/crm-asset-assignments';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const COLLECTION = 'crm_asset_assignments';
const BASE_PATH = '/dashboard/hrm/hr/asset-assignments';
const RBAC_KEY = 'crm_asset_assignment';
const ENTITY_KIND = 'asset_assignment';

export type CrmAssetAssignmentStatus =
    | 'assigned'
    | 'returned'
    | 'lost'
    | 'damaged'
    | 'archived';

export type CrmAssetCondition =
    | 'new'
    | 'good'
    | 'fair'
    | 'poor'
    | 'damaged';

export interface CrmAssetAssignmentDoc {
    _id: string;
    userId?: string;
    asset_id: string;
    asset_name?: string;
    employee_id: string;
    employee_name?: string;
    assigned_at?: string;
    returned_at?: string | null;
    condition_at_assign?: CrmAssetCondition | string;
    condition_at_return?: CrmAssetCondition | string | null;
    notes?: string;
    status: CrmAssetAssignmentStatus;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmAssetAssignmentFilters {
    q?: string;
    status?: CrmAssetAssignmentStatus | 'all';
    assetId?: string;
    employeeId?: string;
}

const VALID_STATUSES: ReadonlySet<CrmAssetAssignmentStatus> =
    new Set<CrmAssetAssignmentStatus>([
        'assigned',
        'returned',
        'lost',
        'damaged',
        'archived',
    ]);

const VALID_CONDITIONS: ReadonlySet<CrmAssetCondition> = new Set<CrmAssetCondition>([
    'new',
    'good',
    'fair',
    'poor',
    'damaged',
]);

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function serialize<T extends WithId<Record<string, unknown>>>(doc: T): CrmAssetAssignmentDoc {
    return JSON.parse(JSON.stringify(doc)) as CrmAssetAssignmentDoc;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getAssetAssignments(
    filters?: CrmAssetAssignmentFilters,
): Promise<CrmAssetAssignmentDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmAssetAssignmentsApi.list({
                q: filters?.q,
                status: filters?.status,
                assetId: filters?.assetId,
                employeeId: filters?.employeeId,
                limit: 200,
            });
            return JSON.parse(
                JSON.stringify(res.items ?? []),
            ) as CrmAssetAssignmentDoc[];
        } catch (e) {
            console.error(
                '[getAssetAssignments] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: ENTITY_KIND,
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
        if (filters?.assetId) filter.asset_id = filters.assetId;
        if (filters?.employeeId) filter.employee_id = filters.employeeId;

        if (filters?.q) {
            const rx = new RegExp(filters.q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
            filter.$or = [
                { asset_name: { $regex: rx } },
                { employee_name: { $regex: rx } },
                { asset_id: { $regex: rx } },
                { employee_id: { $regex: rx } },
            ];
        }

        const rows = await db
            .collection(COLLECTION)
            .find(filter)
            .sort({ assigned_at: -1, createdAt: -1 })
            .limit(200)
            .toArray();

        return rows.map((r) => serialize(r as WithId<Record<string, unknown>>));
    } catch (e) {
        console.error('[getAssetAssignments] failed:', e);
        return [];
    }
}

export async function getAssetAssignmentById(
    id: string,
): Promise<CrmAssetAssignmentDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmAssetAssignmentsApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as CrmAssetAssignmentDoc;
        } catch (e) {
            console.error(
                '[getAssetAssignmentById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: ENTITY_KIND,
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
        console.error('[getAssetAssignmentById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

interface AssignmentPayload {
    asset_id: string;
    asset_name?: string;
    employee_id: string;
    employee_name?: string;
    assigned_at?: Date;
    returned_at?: Date | null;
    condition_at_assign?: CrmAssetCondition;
    condition_at_return?: CrmAssetCondition | null;
    notes?: string;
    status: CrmAssetAssignmentStatus;
}

function readPayload(formData: FormData): {
    payload?: AssignmentPayload;
    error?: string;
} {
    const asset_id = asString(formData.get('asset_id'));
    const employee_id = asString(formData.get('employee_id'));
    if (!asset_id) return { error: 'Asset is required.' };
    if (!employee_id) return { error: 'Employee is required.' };

    const statusRaw = asString(formData.get('status')) ?? 'assigned';
    const status: CrmAssetAssignmentStatus = VALID_STATUSES.has(
        statusRaw as CrmAssetAssignmentStatus,
    )
        ? (statusRaw as CrmAssetAssignmentStatus)
        : 'assigned';

    const conditionAssignRaw = asString(formData.get('condition_at_assign'));
    const condition_at_assign: CrmAssetCondition | undefined =
        conditionAssignRaw && VALID_CONDITIONS.has(conditionAssignRaw as CrmAssetCondition)
            ? (conditionAssignRaw as CrmAssetCondition)
            : undefined;

    const conditionReturnRaw = asString(formData.get('condition_at_return'));
    const condition_at_return: CrmAssetCondition | null | undefined =
        conditionReturnRaw && VALID_CONDITIONS.has(conditionReturnRaw as CrmAssetCondition)
            ? (conditionReturnRaw as CrmAssetCondition)
            : undefined;

    const assignedAtStr = asString(formData.get('assigned_at'));
    const returnedAtStr = asString(formData.get('returned_at'));

    const payload: AssignmentPayload = {
        asset_id,
        asset_name: asString(formData.get('asset_name')),
        employee_id,
        employee_name: asString(formData.get('employee_name')),
        ...(assignedAtStr ? { assigned_at: new Date(assignedAtStr) } : {}),
        ...(returnedAtStr ? { returned_at: new Date(returnedAtStr) } : { returned_at: null }),
        ...(condition_at_assign ? { condition_at_assign } : {}),
        ...(condition_at_return !== undefined ? { condition_at_return } : {}),
        notes: asString(formData.get('notes')),
        status,
    };

    return { payload };
}

export async function saveAssetAssignment(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const assignmentId = asString(formData.get('assignmentId'));
    const isEditing = !!assignmentId;

    const guard = await requirePermission(RBAC_KEY, isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error || !payload) return { error: error ?? 'Invalid payload.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing && ObjectId.isValid(assignmentId!)) {
            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(assignmentId!), userId: userObjectId },
                { $set: { ...payload, updatedAt: now } },
            );
            if (result.matchedCount === 0) return { error: 'Assignment not found.' };

            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'update',
                entityKind: ENTITY_KIND,
                entityId: assignmentId!,
                reason: `Asset assignment status=${payload.status}`,
            });
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${assignmentId}`);
            return { message: 'Assignment updated.', id: assignmentId! };
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
            reason: `Asset ${payload.asset_id} assigned to employee ${payload.employee_id}`,
        });

        revalidatePath(BASE_PATH);
        return { message: 'Assignment created.', id };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveAssetAssignment] failed:', msg);
        return { error: `Failed to save assignment: ${msg}` };
    }
}

export async function deleteAssetAssignment(
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
        console.error('[deleteAssetAssignment] failed:', msg);
        return { success: false, error: msg };
    }
}
