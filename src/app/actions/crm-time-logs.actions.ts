'use server';

/**
 * CRM Time Logs — server-action wrappers around the Rust crate.
 *
 * Rust-only: every code-path delegates to `crmTimeLogsApi`. Field
 * shape mirrors the Rust DTO which serialises with `rename_all = "camelCase"`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmTimeLogsApi,
    type CrmTimeLogCreateInput,
    type CrmTimeLogDoc,
    type CrmTimeLogEntityKind,
    type CrmTimeLogListParams,
    type CrmTimeLogListResponse,
    type CrmTimeLogStatus,
    type CrmTimeLogUpdateInput,
} from '@/lib/rust-client/crm-time-logs';

/* ─── Helpers ────────────────────────────────────────────────────────── */

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

function asBool(v: FormDataEntryValue | null): boolean | undefined {
    if (v == null) return undefined;
    const s = String(v).trim().toLowerCase();
    if (!s) return undefined;
    if (['1', 'true', 'on', 'yes'].includes(s)) return true;
    if (['0', 'false', 'off', 'no'].includes(s)) return false;
    return undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

const VALID_STATUSES: ReadonlySet<CrmTimeLogStatus> = new Set<CrmTimeLogStatus>([
    'running',
    'stopped',
    'approved',
    'rejected',
    'archived',
]);

const VALID_KINDS: ReadonlySet<CrmTimeLogEntityKind> = new Set<CrmTimeLogEntityKind>([
    'task',
    'project_task',
    'issue',
    'ticket',
]);

/** Compute duration minutes from start/end ISO strings — returns 0 if invalid. */
function diffMinutes(startIso?: string, endIso?: string): number {
    if (!startIso || !endIso) return 0;
    const s = new Date(startIso).getTime();
    const e = new Date(endIso).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
    const m = Math.round((e - s) / 60000);
    return m > 0 ? m : 0;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getTimeLogs(
    filters?: CrmTimeLogListParams,
): Promise<CrmTimeLogListResponse> {
    const empty: CrmTimeLogListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_time_log', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmTimeLogsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTimeLogs] rust call failed:', msg);
        recordRustFallback({ entity: 'time_log', op: 'list', errorCode: code, status });
        return empty;
    }
}

export async function getTimeLogById(id: string): Promise<CrmTimeLogDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_time_log', 'view');
    if (!guard.ok) return null;

    try {
        return await crmTimeLogsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getTimeLogById] rust call failed:', msg);
        recordRustFallback({ entity: 'time_log', op: 'get', errorCode: code, status });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmTimeLogCreateInput;
    error?: string;
} {
    const startedAt = asString(formData.get('startedAt'));
    const endedAt = asString(formData.get('endedAt'));

    // Either an explicit duration (minutes) OR start+end is enough to satisfy the form.
    let durationMinutes = asNumber(formData.get('durationMinutes'));
    if (durationMinutes == null || durationMinutes < 0) {
        durationMinutes = diffMinutes(startedAt, endedAt);
    }

    const entityKindRaw = asString(formData.get('entityKind'));
    const entityKind: CrmTimeLogEntityKind | undefined =
        entityKindRaw && VALID_KINDS.has(entityKindRaw as CrmTimeLogEntityKind)
            ? (entityKindRaw as CrmTimeLogEntityKind)
            : undefined;

    return {
        payload: {
            startedAt,
            endedAt,
            durationMinutes,
            entityKind,
            entityId: asString(formData.get('entityId')),
            projectId: asString(formData.get('projectId')),
            taskId: asString(formData.get('taskId')),
            issueId: asString(formData.get('issueId')),
            description: asString(formData.get('description')),
            isBillable: asBool(formData.get('isBillable')) ?? false,
            hourlyRate: asNumber(formData.get('hourlyRate')),
        },
    };
}

export async function saveTimeLog(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const logId = asString(formData.get('logId'));
    const isEditing = !!logId;

    const guard = await requirePermission('crm_time_log', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const statusRaw = asString(formData.get('status'));
            const status: CrmTimeLogStatus | undefined =
                statusRaw && VALID_STATUSES.has(statusRaw as CrmTimeLogStatus)
                    ? (statusRaw as CrmTimeLogStatus)
                    : undefined;
            const patch: CrmTimeLogUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
            };
            const updated = await crmTimeLogsApi.update(logId!, patch);
            revalidatePath('/dashboard/crm/time-tracking');
            revalidatePath(`/dashboard/crm/time-tracking/${logId}`);
            return { message: 'Time log updated.', id: updated?._id ?? logId };
        }
        const created = await crmTimeLogsApi.create(payload);
        revalidatePath('/dashboard/crm/time-tracking');
        return { message: 'Time log created.', id: created.id };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveTimeLog] rust call failed:', msg);
        recordRustFallback({
            entity: 'time_log',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save time log: ${msg}` };
    }
}

export async function deleteTimeLog(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Time log id is required.' };

    const guard = await requirePermission('crm_time_log', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmTimeLogsApi.delete(id);
        revalidatePath('/dashboard/crm/time-tracking');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteTimeLog] rust call failed:', msg);
        recordRustFallback({ entity: 'time_log', op: 'delete', errorCode: code, status });
        return { success: false, error: `Failed to delete time log: ${msg}` };
    }
}

/**
 * Start a timer — creates a running log immediately.
 */
export async function startTimer(
    input: Omit<CrmTimeLogCreateInput, 'startedAt' | 'status' | 'durationMinutes'> = {},
): Promise<{ success: boolean; id?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_time_log', 'create');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const created = await crmTimeLogsApi.create({
            ...input,
            startedAt: new Date().toISOString(),
            status: 'running',
            durationMinutes: 0,
        });
        revalidatePath('/dashboard/crm/time-tracking');
        return { success: true, id: created.id };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({ entity: 'time_log', op: 'create', errorCode: code, status });
        return { success: false, error: `Failed to start timer: ${msg}` };
    }
}

export async function stopTimer(
    logId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!logId) return { success: false, error: 'Time log id is required.' };

    const guard = await requirePermission('crm_time_log', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const log = await crmTimeLogsApi.getById(logId);
        if (!log) return { success: false, error: 'Time log not found.' };

        const endedAt = new Date().toISOString();
        const durationMinutes = diffMinutes(log.startedAt, endedAt);

        await crmTimeLogsApi.update(logId, {
            endedAt,
            durationMinutes,
            status: 'stopped',
        });
        revalidatePath('/dashboard/crm/time-tracking');
        revalidatePath(`/dashboard/crm/time-tracking/${logId}`);
        return { success: true };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        recordRustFallback({ entity: 'time_log', op: 'update', errorCode: code, status });
        return { success: false, error: `Failed to stop timer: ${msg}` };
    }
}
