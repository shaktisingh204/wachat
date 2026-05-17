'use server';

/**
 * CRM Tasks (standalone module) — server-action wrappers around the Rust crate.
 *
 * Rust-only: every code-path delegates to `crmTasksApi`. This file is the
 * canonical source for the standalone `/dashboard/crm/tasks/` module.
 *
 * The legacy `crm-tasks.actions.ts` (which still talks directly to Mongo
 * for Sales CRM compatibility) is preserved as-is. New work goes here.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmTasksApi,
    type CrmTaskChecklistItem,
    type CrmTaskCreateInput,
    type CrmTaskDoc,
    type CrmTaskListParams,
    type CrmTaskListResponse,
    type CrmTaskStatus,
    type CrmTaskUpdateInput,
} from '@/lib/rust-client/crm-tasks';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmTaskStatus> = new Set<CrmTaskStatus>([
    'To-Do',
    'In Progress',
    'Completed',
    'archived',
]);

/**
 * Parse the JSON-encoded checklist coming from the repeater widget. Each
 * row is `{ text, done }`; rows without text are dropped.
 */
function parseChecklistJson(raw: string | null | undefined): CrmTaskChecklistItem[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((row): CrmTaskChecklistItem | null => {
                if (!row || typeof row !== 'object') return null;
                const rec = row as Record<string, unknown>;
                const text = typeof rec.text === 'string' ? rec.text.trim() : '';
                if (!text) return null;
                return { text, done: !!rec.done };
            })
            .filter((x): x is CrmTaskChecklistItem => !!x);
    } catch {
        return [];
    }
}

/** Parse a JSON-encoded array of SabFile URLs from the attachments picker. */
function parseStringArray(raw: string | null | undefined): string[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter((v) => v.length > 0);
    } catch {
        return [];
    }
}

/** Split a comma/semicolon separated reminder list into ISO strings. */
function parseReminders(raw: string | null | undefined): string[] {
    if (!raw) return [];
    return raw
        .split(/[,;\n]\s*/)
        .map((r) => r.trim())
        .filter(Boolean);
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getTasks(
    filters?: CrmTaskListParams,
): Promise<CrmTaskListResponse> {
    const empty: CrmTaskListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_task', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmTasksApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTasks/rust] rust call failed:', msg);
        recordRustFallback({ entity: 'task', op: 'list', errorCode: code, status });
        return empty;
    }
}

export async function getTaskById(id: string): Promise<CrmTaskDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_task', 'view');
    if (!guard.ok) return null;

    try {
        return await crmTasksApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTaskById/rust] rust call failed:', msg);
        recordRustFallback({ entity: 'task', op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmTaskCreateInput;
    error?: string;
} {
    const title = asString(formData.get('title'));
    if (!title) {
        return { payload: {} as CrmTaskCreateInput, error: 'Title is required.' };
    }

    const checklist = parseChecklistJson(
        (formData.get('checklist') as string | null) ?? '[]',
    );
    const attachments = parseStringArray(
        (formData.get('attachments') as string | null) ?? '[]',
    );
    const reminders = parseReminders(
        (formData.get('reminders') as string | null) ?? '',
    );

    const linkedKindRaw = asString(formData.get('linkedKind'));
    // `none` is the sentinel meaning "no link"; don't propagate it to Rust.
    const linkedKind =
        linkedKindRaw && linkedKindRaw !== 'none' ? linkedKindRaw : undefined;
    const linkedId = linkedKind ? asString(formData.get('linkedId')) : undefined;

    return {
        payload: {
            title,
            description: asString(formData.get('description')),
            type: asString(formData.get('type')),
            priority: asString(formData.get('priority')),
            dueDate: asString(formData.get('dueDate')),
            reminders,
            checklist,
            attachments,
            assignedTo: asString(formData.get('assignedTo')),
            linkedKind,
            linkedId,
        },
    };
}

export async function saveTask(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const taskId = asString(formData.get('taskId'));
    const isEditing = !!taskId;

    const guard = await requirePermission('crm_task', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const statusRaw = asString(formData.get('status'));
            const status: CrmTaskStatus | undefined =
                statusRaw && VALID_STATUSES.has(statusRaw as CrmTaskStatus)
                    ? (statusRaw as CrmTaskStatus)
                    : undefined;
            const patch: CrmTaskUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
            };
            const updated = await crmTasksApi.update(taskId!, patch);
            revalidatePath('/dashboard/crm/tasks');
            revalidatePath(`/dashboard/crm/tasks/${taskId}`);
            return { message: 'Task updated.', id: updated?._id ?? taskId };
        }
        const created = await crmTasksApi.create(payload);
        revalidatePath('/dashboard/crm/tasks');
        return { message: 'Task created.', id: created.id };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveTask/rust] rust call failed:', msg);
        recordRustFallback({
            entity: 'task',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save task: ${msg}` };
    }
}

export async function deleteTaskRust(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Task id is required.' };

    const guard = await requirePermission('crm_task', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmTasksApi.delete(id);
        revalidatePath('/dashboard/crm/tasks');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteTaskRust] rust call failed:', msg);
        recordRustFallback({ entity: 'task', op: 'delete', errorCode: code, status });
        return { success: false, error: `Failed to delete task: ${msg}` };
    }
}

/** Mark a single task complete (used by checklist + table quick-actions). */
export async function completeTask(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Task id is required.' };

    const guard = await requirePermission('crm_task', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        await crmTasksApi.update(id, { status: 'Completed' });
        revalidatePath('/dashboard/crm/tasks');
        revalidatePath(`/dashboard/crm/tasks/${id}`);
        return { success: true };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({ entity: 'task', op: 'update', errorCode: code, status });
        return { success: false, error: `Failed to complete task: ${msg}` };
    }
}

/**
 * Move a task to a different status — used by the kanban click-to-move
 * arrows. The kanban groups tasks by `task.status` (mapping each column to
 * its `defaultStatus`), so flipping status is equivalent to moving lanes.
 */
export async function moveTaskToStatus(
    id: string,
    nextStatus: CrmTaskStatus,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Task id is required.' };
    if (!VALID_STATUSES.has(nextStatus)) {
        return { success: false, error: 'Invalid status.' };
    }

    const guard = await requirePermission('crm_task', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        await crmTasksApi.update(id, { status: nextStatus });
        revalidatePath('/dashboard/crm/projects/kanban');
        revalidatePath('/dashboard/crm/tasks');
        revalidatePath(`/dashboard/crm/tasks/${id}`);
        return { success: true };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({ entity: 'task', op: 'update', errorCode: code, status });
        return { success: false, error: `Failed to move task: ${msg}` };
    }
}
