'use server';

/**
 * CRM HR Training — server-action wrappers around the Rust crate.
 *
 * Rust-only path (no Mongo shadow). On Rust failure we record a fallback
 * telemetry event and return the canonical `{ message, error, id }` shape
 * consumed by `useActionState`.
 *
 * Field shape mirrors the Rust DTO (`rust/crates/crm-training/src/dto.rs`,
 * `rename_all = "camelCase"`).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmTrainingApi,
    type CrmTrainingCreateInput,
    type CrmTrainingDeliveryMode,
    type CrmTrainingDoc,
    type CrmTrainingListParams,
    type CrmTrainingListResponse,
    type CrmTrainingStatus,
    type CrmTrainingType,
    type CrmTrainingUpdateInput,
} from '@/lib/rust-client/crm-training';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function asInt(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function asNum(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asTags(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const tags = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return tags.length > 0 ? tags : undefined;
}

function asList(v: FormDataEntryValue | null): string[] | undefined {
    return asTags(v);
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getTrainings(
    filters?: CrmTrainingListParams,
): Promise<CrmTrainingListResponse> {
    const empty: CrmTrainingListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_training', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmTrainingApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTrainings] rust call failed:', msg);
        recordRustFallback({
            entity: 'training',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getTrainingById(
    id: string,
): Promise<CrmTrainingDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_training', 'view');
    if (!guard.ok) return null;

    try {
        return await crmTrainingApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTrainingById] rust call failed:', msg);
        recordRustFallback({
            entity: 'training',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmTrainingStatus> = new Set<CrmTrainingStatus>([
    'planned',
    'open_for_enrollment',
    'in_progress',
    'completed',
    'cancelled',
    'archived',
]);

function readPayload(formData: FormData): {
    payload: CrmTrainingCreateInput;
    status?: CrmTrainingStatus;
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name) {
        return {
            payload: {} as CrmTrainingCreateInput,
            error: 'Training name is required.',
        };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmTrainingStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmTrainingStatus)
            ? (statusRaw as CrmTrainingStatus)
            : undefined;

    const payload: CrmTrainingCreateInput = {
        name,
        description: asString(formData.get('description')),
        trainingType: asString(formData.get('trainingType')) as
            | CrmTrainingType
            | string
            | undefined,
        deliveryMode: asString(formData.get('deliveryMode')) as
            | CrmTrainingDeliveryMode
            | string
            | undefined,
        trainerName: asString(formData.get('trainerName')),
        trainerId: asString(formData.get('trainerId')),
        provider: asString(formData.get('provider')),
        startDate: asString(formData.get('startDate')),
        endDate: asString(formData.get('endDate')),
        durationHours: asNum(formData.get('durationHours')),
        location: asString(formData.get('location')),
        maxParticipants: asInt(formData.get('maxParticipants')),
        costPerPerson: asNum(formData.get('costPerPerson')),
        currency: asString(formData.get('currency')),
        certificationProvided: asBool(formData.get('certificationProvided')),
        materialsUrl: asString(formData.get('materialsUrl')),
        isMandatory: asBool(formData.get('isMandatory')),
        departmentIds: asList(formData.get('departmentIds')),
        tags: asTags(formData.get('tags')),
        notes: asString(formData.get('notes')),
    };

    return { payload, status };
}

export async function saveTraining(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const trainingId = asString(formData.get('trainingId'));
    const isEditing = !!trainingId;

    const guard = await requirePermission(
        'crm_training',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, status, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmTrainingUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
            };
            const updated = await crmTrainingApi.update(trainingId!, patch);
            revalidatePath('/dashboard/hrm/hr/training');
            revalidatePath(`/dashboard/hrm/hr/training/${trainingId}`);
            return {
                message: 'Training updated.',
                id: updated?._id ?? trainingId,
            };
        }

        const created = await crmTrainingApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/training');
        return {
            message: 'Training created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveTraining] rust call failed:', msg);
        recordRustFallback({
            entity: 'training',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save training: ${msg}` };
    }
}

export async function deleteTraining(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Training id is required.' };

    const guard = await requirePermission('crm_training', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmTrainingApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/training');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteTraining] rust call failed:', msg);
        recordRustFallback({
            entity: 'training',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete training: ${msg}` };
    }
}

/* ─── Bulk ────────────────────────────────────────────────────────────── */

export async function bulkArchiveTrainings(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_training', 'edit');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmTrainingApi.update(id, { status: 'archived' });
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/training');
    return { succeeded, failed };
}

export async function bulkDeleteTrainings(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_training', 'delete');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmTrainingApi.delete(id);
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/training');
    return { succeeded, failed };
}
