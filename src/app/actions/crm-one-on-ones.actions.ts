'use server';

/**
 * CRM HR One-on-Ones — server-action wrappers around the Rust crate.
 *
 * Delegates to `crmOneOnOnesApi` (Rust `/v1/crm/one-on-ones`).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmOneOnOnesApi,
    type CrmOneOnOneActionItem,
    type CrmOneOnOneAgendaItem,
    type CrmOneOnOneCreateInput,
    type CrmOneOnOneDoc,
    type CrmOneOnOneListParams,
    type CrmOneOnOneListResponse,
    type CrmOneOnOneMood,
    type CrmOneOnOneStatus,
    type CrmOneOnOneUpdateInput,
} from '@/lib/rust-client/crm-one-on-ones';

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

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
}

function asAgenda(v: FormDataEntryValue | null): CrmOneOnOneAgendaItem[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return undefined;
        const out: CrmOneOnOneAgendaItem[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const topic = typeof o.topic === 'string' ? o.topic.trim() : '';
            if (!topic) continue;
            const ag: CrmOneOnOneAgendaItem = {
                id:
                    typeof o.id === 'string' && o.id
                        ? o.id
                        : `ag_${Math.random().toString(36).slice(2, 10)}`,
                topic,
            };
            if (typeof o.owner === 'string' && o.owner) ag.owner = o.owner;
            const t = typeof o.timeMinutes === 'number' ? o.timeMinutes : Number(o.timeMinutes);
            if (Number.isFinite(t)) ag.timeMinutes = t;
            if (typeof o.discussed === 'boolean') ag.discussed = o.discussed;
            out.push(ag);
        }
        return out.length > 0 ? out : undefined;
    } catch {
        return undefined;
    }
}

function asActionItems(
    v: FormDataEntryValue | null,
): CrmOneOnOneActionItem[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return undefined;
        const out: CrmOneOnOneActionItem[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const description = typeof o.description === 'string' ? o.description.trim() : '';
            if (!description) continue;
            const ai: CrmOneOnOneActionItem = {
                id:
                    typeof o.id === 'string' && o.id
                        ? o.id
                        : `ai_${Math.random().toString(36).slice(2, 10)}`,
                description,
                status: typeof o.status === 'string' && o.status ? o.status : 'pending',
            };
            if (typeof o.assigneeId === 'string' && o.assigneeId) ai.assigneeId = o.assigneeId;
            if (typeof o.dueDate === 'string' && o.dueDate) ai.dueDate = o.dueDate;
            out.push(ai);
        }
        return out.length > 0 ? out : undefined;
    } catch {
        return undefined;
    }
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getOneOnOnes(
    filters?: CrmOneOnOneListParams,
): Promise<CrmOneOnOneListResponse> {
    const empty: CrmOneOnOneListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_one_on_one', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmOneOnOnesApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOneOnOnes] rust call failed:', msg);
        recordRustFallback({
            entity: 'one_on_one',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getOneOnOneById(id: string): Promise<CrmOneOnOneDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_one_on_one', 'view');
    if (!guard.ok) return null;

    try {
        return await crmOneOnOnesApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOneOnOneById] rust call failed:', msg);
        recordRustFallback({
            entity: 'one_on_one',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmOneOnOneStatus> = new Set<CrmOneOnOneStatus>([
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'no_show',
    'archived',
]);

const VALID_MOODS: ReadonlySet<CrmOneOnOneMood> = new Set<CrmOneOnOneMood>([
    'happy',
    'neutral',
    'concerned',
]);

function readPayload(formData: FormData): {
    payload: CrmOneOnOneCreateInput;
    status?: CrmOneOnOneStatus;
    error?: string;
} {
    const managerId = asString(formData.get('managerId'));
    if (!managerId) {
        return { payload: {} as CrmOneOnOneCreateInput, error: 'Manager id is required.' };
    }
    const reportId = asString(formData.get('reportId'));
    if (!reportId) {
        return { payload: {} as CrmOneOnOneCreateInput, error: 'Report id is required.' };
    }
    const scheduledAt = asString(formData.get('scheduledAt'));
    if (!scheduledAt) {
        return {
            payload: {} as CrmOneOnOneCreateInput,
            error: 'Scheduled date/time is required.',
        };
    }

    const moodRaw = asString(formData.get('mood'));
    const mood: CrmOneOnOneMood | undefined =
        moodRaw && VALID_MOODS.has(moodRaw as CrmOneOnOneMood)
            ? (moodRaw as CrmOneOnOneMood)
            : undefined;

    const statusRaw = asString(formData.get('status'));
    const status: CrmOneOnOneStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmOneOnOneStatus)
            ? (statusRaw as CrmOneOnOneStatus)
            : undefined;

    const payload: CrmOneOnOneCreateInput = {
        managerId,
        managerName: asString(formData.get('managerName')),
        reportId,
        reportName: asString(formData.get('reportName')),
        scheduledAt,
        durationMinutes: asNumber(formData.get('durationMinutes')),
        location: asString(formData.get('location')),
        agenda: asAgenda(formData.get('agenda')),
        discussionNotes: asString(formData.get('discussionNotes')),
        actionItems: asActionItems(formData.get('actionItems')),
        engagementScore: asNumber(formData.get('engagementScore')),
        nextMeetingAt: asString(formData.get('nextMeetingAt')),
        isPrivate: asBool(formData.get('isPrivate')),
        ...(mood ? { mood } : {}),
    };

    return { payload, status };
}

export async function saveOneOnOne(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const oneOnOneId = asString(formData.get('oneOnOneId'));
    const isEditing = !!oneOnOneId;

    const guard = await requirePermission(
        'crm_one_on_one',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, status, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmOneOnOneUpdateInput = { ...payload, ...(status ? { status } : {}) };
            const updated = await crmOneOnOnesApi.update(oneOnOneId!, patch);
            revalidatePath('/dashboard/hrm/hr/one-on-ones');
            revalidatePath(`/dashboard/hrm/hr/one-on-ones/${oneOnOneId}`);
            return {
                message: 'One-on-one updated.',
                id: updated?._id ?? oneOnOneId,
            };
        }

        const created = await crmOneOnOnesApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/one-on-ones');
        return {
            message: 'One-on-one created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: errStatus, msg } = rustError(e);
        console.error('[saveOneOnOne] rust call failed:', msg);
        recordRustFallback({
            entity: 'one_on_one',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: errStatus,
        });
        return { error: `Failed to save one-on-one: ${msg}` };
    }
}

export async function deleteOneOnOne(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'One-on-one id is required.' };

    const guard = await requirePermission('crm_one_on_one', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmOneOnOnesApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/one-on-ones');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteOneOnOne] rust call failed:', msg);
        recordRustFallback({
            entity: 'one_on_one',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete one-on-one: ${msg}` };
    }
}
