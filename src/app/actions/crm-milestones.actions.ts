'use server';

/**
 * CRM Milestones — server-action wrappers around the Rust crate.
 *
 * Delegates to `crmMilestonesApi` (Rust). On failure we record a fallback
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
    crmMilestonesApi,
    type CrmMilestoneCreateInput,
    type CrmMilestoneDoc,
    type CrmMilestoneListParams,
    type CrmMilestoneListResponse,
    type CrmMilestonePriority,
    type CrmMilestoneStatus,
    type CrmMilestoneUpdateInput,
} from '@/lib/rust-client/crm-milestones';

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

function asTags(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const tags = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return tags.length > 0 ? tags : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmMilestoneStatus> = new Set<CrmMilestoneStatus>([
    'planned',
    'in_progress',
    'completed',
    'overdue',
    'archived',
]);

const VALID_PRIORITIES: ReadonlySet<CrmMilestonePriority> =
    new Set<CrmMilestonePriority>(['low', 'medium', 'high']);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getMilestones(
    filters?: CrmMilestoneListParams,
): Promise<CrmMilestoneListResponse> {
    const empty: CrmMilestoneListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_milestone', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmMilestonesApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getMilestones] rust call failed:', msg);
        recordRustFallback({
            entity: 'milestone',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getMilestoneById(
    id: string,
): Promise<CrmMilestoneDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_milestone', 'view');
    if (!guard.ok) return null;

    try {
        return await crmMilestonesApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getMilestoneById] rust call failed:', msg);
        recordRustFallback({
            entity: 'milestone',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmMilestoneCreateInput;
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name) {
        return { payload: {} as CrmMilestoneCreateInput, error: 'Name is required.' };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmMilestoneStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmMilestoneStatus)
            ? (statusRaw as CrmMilestoneStatus)
            : undefined;

    const priorityRaw = asString(formData.get('priority'));
    const priority: CrmMilestonePriority | undefined =
        priorityRaw && VALID_PRIORITIES.has(priorityRaw as CrmMilestonePriority)
            ? (priorityRaw as CrmMilestonePriority)
            : undefined;

    const payload: CrmMilestoneCreateInput = {
        name,
        description: asString(formData.get('description')),
        projectId: asString(formData.get('projectId')),
        parentId: asString(formData.get('parentId')),
        dueDate: asString(formData.get('dueDate')),
        completedAt: asString(formData.get('completedAt')),
        progress: asNumber(formData.get('progress')),
        ownerId: asString(formData.get('ownerId')),
        tags: asTags(formData.get('tags')),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
    };

    return { payload };
}

export async function saveMilestone(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const milestoneId = asString(formData.get('milestoneId'));
    const isEditing = !!milestoneId;

    const guard = await requirePermission(
        'crm_milestone',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmMilestoneUpdateInput = payload;
            const updated = await crmMilestonesApi.update(milestoneId!, patch);
            revalidatePath('/dashboard/crm/projects/milestones');
            revalidatePath(`/dashboard/crm/projects/milestones/${milestoneId}`);
            return {
                message: 'Milestone updated.',
                id: updated?._id ?? milestoneId,
            };
        }

        const created = await crmMilestonesApi.create(payload);
        revalidatePath('/dashboard/crm/projects/milestones');
        return {
            message: 'Milestone created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveMilestone] rust call failed:', msg);
        recordRustFallback({
            entity: 'milestone',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save milestone: ${msg}` };
    }
}

export async function deleteMilestone(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Milestone id is required.' };

    const guard = await requirePermission('crm_milestone', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmMilestonesApi.delete(id);
        revalidatePath('/dashboard/crm/projects/milestones');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteMilestone] rust call failed:', msg);
        recordRustFallback({
            entity: 'milestone',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete milestone: ${msg}` };
    }
}
