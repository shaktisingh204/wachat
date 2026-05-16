'use server';

/**
 * CRM HR Interviews — server-action wrappers around the Rust crate.
 *
 * Mirrors `crm-policies.actions.ts`. Returns `{ items: [], … }` on Rust
 * failure rather than crashing.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmInterviewsApi,
    type CrmInterviewCreateInput,
    type CrmInterviewDoc,
    type CrmInterviewListParams,
    type CrmInterviewListResponse,
    type CrmInterviewRecommendation,
    type CrmInterviewStatus,
    type CrmInterviewType,
    type CrmInterviewUpdateInput,
} from '@/lib/rust-client/crm-interviews';

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

function asStringList(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const list = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return list.length > 0 ? list : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getInterviews(
    filters?: CrmInterviewListParams,
): Promise<CrmInterviewListResponse> {
    const empty: CrmInterviewListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_interview', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmInterviewsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getInterviews] rust call failed:', msg);
        recordRustFallback({
            entity: 'interview',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getInterviewById(
    id: string,
): Promise<CrmInterviewDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_interview', 'view');
    if (!guard.ok) return null;

    try {
        return await crmInterviewsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getInterviewById] rust call failed:', msg);
        recordRustFallback({
            entity: 'interview',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmInterviewStatus> = new Set<
    CrmInterviewStatus
>([
    'scheduled',
    'rescheduled',
    'completed',
    'no_show',
    'cancelled',
    'archived',
]);

const VALID_TYPES: ReadonlySet<string> = new Set([
    'phone',
    'video',
    'onsite',
    'async_assessment',
]);

const VALID_RECOMMENDATIONS: ReadonlySet<string> = new Set([
    'strong_hire',
    'hire',
    'no_hire',
    'strong_no_hire',
]);

function readPayload(formData: FormData): {
    payload: CrmInterviewCreateInput;
    error?: string;
} {
    const candidateId = asString(formData.get('candidateId'));
    if (!candidateId) {
        return {
            payload: { candidateId: '', scheduledAt: '' },
            error: 'Candidate is required.',
        };
    }

    const scheduledAt = asString(formData.get('scheduledAt'));
    if (!scheduledAt) {
        return {
            payload: { candidateId, scheduledAt: '' },
            error: 'Scheduled date/time is required.',
        };
    }

    const typeRaw = asString(formData.get('interviewType'));
    const interviewType: CrmInterviewType | undefined =
        typeRaw && VALID_TYPES.has(typeRaw)
            ? (typeRaw as CrmInterviewType)
            : undefined;

    const payload: CrmInterviewCreateInput = {
        candidateId,
        candidateName: asString(formData.get('candidateName')),
        jobId: asString(formData.get('jobId')),
        round: asNumber(formData.get('round')),
        roundName: asString(formData.get('roundName')),
        scheduledAt,
        durationMinutes: asNumber(formData.get('durationMinutes')),
        location: asString(formData.get('location')),
        interviewers: asStringList(formData.get('interviewers')),
        interviewerNames: asStringList(formData.get('interviewerNames')),
        ...(interviewType ? { interviewType } : {}),
    };

    return { payload };
}

export async function saveInterview(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const interviewId = asString(formData.get('interviewId'));
    const isEditing = !!interviewId;

    const guard = await requirePermission(
        'crm_interview',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    const statusRaw = asString(formData.get('status'));
    const status: CrmInterviewStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmInterviewStatus)
            ? (statusRaw as CrmInterviewStatus)
            : undefined;
    const feedback = asString(formData.get('feedback'));
    const rating = asNumber(formData.get('rating'));
    const recommendationRaw = asString(formData.get('recommendation'));
    const recommendation: CrmInterviewRecommendation | undefined =
        recommendationRaw && VALID_RECOMMENDATIONS.has(recommendationRaw)
            ? (recommendationRaw as CrmInterviewRecommendation)
            : undefined;

    try {
        if (isEditing) {
            const patch: CrmInterviewUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
                ...(feedback ? { feedback } : {}),
                ...(rating != null ? { rating } : {}),
                ...(recommendation ? { recommendation } : {}),
            };
            const updated = await crmInterviewsApi.update(interviewId!, patch);
            revalidatePath('/dashboard/hrm/hr/interviews');
            revalidatePath(`/dashboard/hrm/hr/interviews/${interviewId}`);
            return {
                message: 'Interview updated.',
                id: updated?._id ?? interviewId,
            };
        }

        const created = await crmInterviewsApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/interviews');
        return {
            message: 'Interview scheduled.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: errStatus, msg } = rustError(e);
        console.error('[saveInterview] rust call failed:', msg);
        recordRustFallback({
            entity: 'interview',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: errStatus,
        });
        return { error: `Failed to save interview: ${msg}` };
    }
}

export async function deleteInterview(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Interview id is required.' };

    const guard = await requirePermission('crm_interview', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmInterviewsApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/interviews');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteInterview] rust call failed:', msg);
        recordRustFallback({
            entity: 'interview',
            op: 'delete',
            errorCode: code,
            status,
        });
        return {
            success: false,
            error: `Failed to delete interview: ${msg}`,
        };
    }
}
