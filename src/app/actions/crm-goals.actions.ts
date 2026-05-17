'use server';

/**
 * CRM HR Goal Setting — server-action wrappers around the Rust crate.
 *
 * Delegates to `crmGoalsApi` (Rust `/v1/crm/goals`). On failure we record a
 * fallback telemetry event and return `{ error }` — there is no Mongo
 * shadow read. Field shape mirrors the Rust DTO (camelCase).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmGoalsApi,
    type CrmGoalCreateInput,
    type CrmGoalDoc,
    type CrmGoalListParams,
    type CrmGoalListResponse,
    type CrmGoalStatus,
    type CrmGoalUpdateInput,
} from '@/lib/rust-client/crm-goals';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmGoalStatus> = new Set<CrmGoalStatus>([
    'draft',
    'active',
    'achieved',
    'missed',
    'archived',
]);

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getGoals(
    filters?: CrmGoalListParams,
): Promise<CrmGoalListResponse> {
    const empty: CrmGoalListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_goal', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmGoalsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getGoals] rust call failed:', msg);
        recordRustFallback({
            entity: 'goal',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getGoalById(id: string): Promise<CrmGoalDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_goal', 'view');
    if (!guard.ok) return null;

    try {
        return await crmGoalsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getGoalById] rust call failed:', msg);
        recordRustFallback({
            entity: 'goal',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmGoalCreateInput;
    error?: string;
} {
    const title = asString(formData.get('title'));
    if (!title) {
        return { payload: {} as CrmGoalCreateInput, error: 'Title is required.' };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmGoalStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmGoalStatus)
            ? (statusRaw as CrmGoalStatus)
            : undefined;

    const payload: CrmGoalCreateInput = {
        title,
        description: asString(formData.get('description')),
        employeeId: asString(formData.get('employeeId')),
        employeeName: asString(formData.get('employeeName')),
        period: asString(formData.get('period')),
        target: asString(formData.get('target')),
        achieved: asString(formData.get('achieved')),
        progress: asNumber(formData.get('progress')),
        weight: asNumber(formData.get('weight')),
        kpi: asString(formData.get('kpi')),
        ...(status ? { status } : {}),
    };

    return { payload };
}

export async function saveGoal(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const goalId = asString(formData.get('goalId'));
    const isEditing = !!goalId;

    const guard = await requirePermission(
        'crm_goal',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmGoalUpdateInput = payload;
            const updated = await crmGoalsApi.update(goalId!, patch);
            revalidatePath('/dashboard/hrm/payroll/goal-setting');
            revalidatePath(`/dashboard/hrm/payroll/goal-setting/${goalId}`);
            return {
                message: 'Goal updated.',
                id: updated?._id ?? goalId,
            };
        }

        const created = await crmGoalsApi.create(payload);
        revalidatePath('/dashboard/hrm/payroll/goal-setting');
        return {
            message: 'Goal created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveGoal] rust call failed:', msg);
        recordRustFallback({
            entity: 'goal',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save goal: ${msg}` };
    }
}

export async function deleteGoal(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Goal id is required.' };

    const guard = await requirePermission('crm_goal', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmGoalsApi.delete(id);
        revalidatePath('/dashboard/hrm/payroll/goal-setting');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteGoal] rust call failed:', msg);
        recordRustFallback({
            entity: 'goal',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete goal: ${msg}` };
    }
}
