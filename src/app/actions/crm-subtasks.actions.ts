'use server';

/**
 * CRM Subtasks — server-action wrappers around the Rust crate.
 *
 * Delegates to `crmSubtasksApi` (Rust). On failure we record a fallback
 * telemetry event and return `{ error }`.
 *
 * Field shape mirrors the Rust DTO which serialises with `rename_all = "camelCase"`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmSubtasksApi,
    type CrmSubtaskCreateInput,
    type CrmSubtaskDoc,
    type CrmSubtaskListParams,
    type CrmSubtaskListResponse,
    type CrmSubtaskParentKind,
    type CrmSubtaskStatus,
    type CrmSubtaskUpdateInput,
} from '@/lib/rust-client/crm-subtasks';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (s == null) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmSubtaskStatus> = new Set<CrmSubtaskStatus>([
    'todo',
    'in_progress',
    'done',
    'archived',
]);

const VALID_PARENT_KINDS: ReadonlySet<CrmSubtaskParentKind> =
    new Set<CrmSubtaskParentKind>(['task', 'project_task']);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getSubtasks(
    filters?: CrmSubtaskListParams,
): Promise<CrmSubtaskListResponse> {
    const empty: CrmSubtaskListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_subtask', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmSubtasksApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getSubtasks] rust call failed:', msg);
        recordRustFallback({
            entity: 'subtask',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getSubtaskById(id: string): Promise<CrmSubtaskDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_subtask', 'view');
    if (!guard.ok) return null;

    try {
        return await crmSubtasksApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getSubtaskById] rust call failed:', msg);
        recordRustFallback({
            entity: 'subtask',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmSubtaskCreateInput;
    error?: string;
} {
    const title = asString(formData.get('title'));
    if (!title) {
        return { payload: {} as CrmSubtaskCreateInput, error: 'Title is required.' };
    }

    const parentId = asString(formData.get('parentId'));
    if (!parentId) {
        return {
            payload: {} as CrmSubtaskCreateInput,
            error: 'Parent id is required.',
        };
    }

    const parentKindRaw = asString(formData.get('parentKind'));
    const parentKind: CrmSubtaskParentKind | undefined =
        parentKindRaw && VALID_PARENT_KINDS.has(parentKindRaw as CrmSubtaskParentKind)
            ? (parentKindRaw as CrmSubtaskParentKind)
            : 'task';

    const statusRaw = asString(formData.get('status'));
    const status: CrmSubtaskStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmSubtaskStatus)
            ? (statusRaw as CrmSubtaskStatus)
            : undefined;

    const payload: CrmSubtaskCreateInput = {
        parentId,
        parentKind,
        title,
        description: asString(formData.get('description')),
        assigneeId: asString(formData.get('assigneeId')),
        dueDate: asString(formData.get('dueDate')),
        order: asNumber(formData.get('order')),
        ...(status ? { status } : {}),
    };

    return { payload };
}

export async function saveSubtask(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const subtaskId = asString(formData.get('subtaskId'));
    const isEditing = !!subtaskId;

    const guard = await requirePermission(
        'crm_subtask',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmSubtaskUpdateInput = {
                title: payload.title,
                description: payload.description,
                assigneeId: payload.assigneeId,
                dueDate: payload.dueDate,
                order: payload.order,
                status: payload.status,
            };
            const updated = await crmSubtasksApi.update(subtaskId!, patch);
            revalidatePath('/dashboard/crm/projects/subtasks');
            revalidatePath(`/dashboard/crm/projects/subtasks/${subtaskId}`);
            return {
                message: 'Subtask updated.',
                id: updated?._id ?? subtaskId,
            };
        }

        const created = await crmSubtasksApi.create(payload);
        revalidatePath('/dashboard/crm/projects/subtasks');
        return {
            message: 'Subtask created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveSubtask] rust call failed:', msg);
        recordRustFallback({
            entity: 'subtask',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save subtask: ${msg}` };
    }
}

export async function deleteSubtask(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Subtask id is required.' };

    const guard = await requirePermission('crm_subtask', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmSubtasksApi.delete(id);
        revalidatePath('/dashboard/crm/projects/subtasks');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteSubtask] rust call failed:', msg);
        recordRustFallback({
            entity: 'subtask',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete subtask: ${msg}` };
    }
}
