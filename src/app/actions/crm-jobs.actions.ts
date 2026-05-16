'use server';

/**
 * CRM HR Jobs — server-action wrappers around the Rust crate.
 *
 * Mirrors the canonical `crm-policies.actions.ts` contract: every
 * code-path delegates to `crmJobsApi`. On Rust failure we record a
 * fallback telemetry event and return `{ error }` — no legacy Mongo
 * fallback.
 *
 * Field shape mirrors the Rust DTO at `rust/crates/crm-jobs/src/dto.rs`
 * (camelCase).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmJobsApi,
    type CrmJobCreateInput,
    type CrmJobDoc,
    type CrmJobEmploymentType,
    type CrmJobListParams,
    type CrmJobListResponse,
    type CrmJobRemotePolicy,
    type CrmJobStatus,
    type CrmJobUpdateInput,
} from '@/lib/rust-client/crm-jobs';

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

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getJobs(
    filters?: CrmJobListParams,
): Promise<CrmJobListResponse> {
    const empty: CrmJobListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_job', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmJobsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getJobs] rust call failed:', msg);
        recordRustFallback({
            entity: 'job',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getJobById(id: string): Promise<CrmJobDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_job', 'view');
    if (!guard.ok) return null;

    try {
        return await crmJobsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getJobById] rust call failed:', msg);
        recordRustFallback({
            entity: 'job',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmJobStatus> = new Set<CrmJobStatus>([
    'draft',
    'open',
    'on_hold',
    'filled',
    'closed',
    'archived',
]);

const VALID_EMPLOYMENT_TYPES: ReadonlySet<string> = new Set([
    'full_time',
    'part_time',
    'contract',
    'intern',
    'temporary',
]);

const VALID_REMOTE_POLICIES: ReadonlySet<string> = new Set([
    'onsite',
    'remote',
    'hybrid',
]);

function readPayload(formData: FormData): {
    payload: CrmJobCreateInput;
    error?: string;
} {
    const title = asString(formData.get('title'));
    if (!title) {
        return { payload: { title: '' }, error: 'Title is required.' };
    }

    const employmentTypeRaw = asString(formData.get('employmentType'));
    const employmentType: CrmJobEmploymentType | undefined =
        employmentTypeRaw && VALID_EMPLOYMENT_TYPES.has(employmentTypeRaw)
            ? (employmentTypeRaw as CrmJobEmploymentType)
            : undefined;

    const remoteRaw = asString(formData.get('remotePolicy'));
    const remotePolicy: CrmJobRemotePolicy | undefined =
        remoteRaw && VALID_REMOTE_POLICIES.has(remoteRaw)
            ? (remoteRaw as CrmJobRemotePolicy)
            : undefined;

    const payload: CrmJobCreateInput = {
        title,
        departmentId: asString(formData.get('departmentId')),
        departmentName: asString(formData.get('departmentName')),
        description: asString(formData.get('description')),
        responsibilities: asString(formData.get('responsibilities')),
        requirements: asString(formData.get('requirements')),
        experienceMin: asNumber(formData.get('experienceMin')),
        experienceMax: asNumber(formData.get('experienceMax')),
        salaryMin: asNumber(formData.get('salaryMin')),
        salaryMax: asNumber(formData.get('salaryMax')),
        currency: asString(formData.get('currency')),
        location: asString(formData.get('location')),
        openings: asNumber(formData.get('openings')),
        hiringManagerId: asString(formData.get('hiringManagerId')),
        publishUrl: asString(formData.get('publishUrl')),
        publishAt: asString(formData.get('publishAt')),
        closeAt: asString(formData.get('closeAt')),
        tags: asTags(formData.get('tags')),
        ...(employmentType ? { employmentType } : {}),
        ...(remotePolicy ? { remotePolicy } : {}),
    };

    return { payload };
}

export async function saveJob(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const jobId = asString(formData.get('jobId'));
    const isEditing = !!jobId;

    const guard = await requirePermission(
        'crm_job',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    const statusRaw = asString(formData.get('status'));
    const filled = asNumber(formData.get('filled'));
    const status: CrmJobStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmJobStatus)
            ? (statusRaw as CrmJobStatus)
            : undefined;

    try {
        if (isEditing) {
            const patch: CrmJobUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
                ...(filled != null ? { filled } : {}),
            };
            const updated = await crmJobsApi.update(jobId!, patch);
            revalidatePath('/dashboard/hrm/hr/jobs');
            revalidatePath(`/dashboard/hrm/hr/jobs/${jobId}`);
            return {
                message: 'Job updated.',
                id: updated?._id ?? jobId,
            };
        }

        const created = await crmJobsApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/jobs');
        return {
            message: 'Job created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: errStatus, msg } = rustError(e);
        console.error('[saveJob] rust call failed:', msg);
        recordRustFallback({
            entity: 'job',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: errStatus,
        });
        return { error: `Failed to save job: ${msg}` };
    }
}

export async function deleteJob(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Job id is required.' };

    const guard = await requirePermission('crm_job', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmJobsApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/jobs');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteJob] rust call failed:', msg);
        recordRustFallback({
            entity: 'job',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete job: ${msg}` };
    }
}
