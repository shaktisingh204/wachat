'use server';

/**
 * CRM HR Candidates — server-action wrappers around the Rust crate.
 *
 * Mirrors `crm-policies.actions.ts`. The `resumeUrl` field is fed by
 * `<SabFilePickerButton>` on the form side — never by a free-text URL
 * paste (SabFiles policy).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmCandidatesApi,
    type CrmCandidateCreateInput,
    type CrmCandidateDoc,
    type CrmCandidateListParams,
    type CrmCandidateListResponse,
    type CrmCandidateSource,
    type CrmCandidateStage,
    type CrmCandidateUpdateInput,
} from '@/lib/rust-client/crm-candidates';

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

export async function getCandidates(
    filters?: CrmCandidateListParams,
): Promise<CrmCandidateListResponse> {
    const empty: CrmCandidateListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_candidate', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmCandidatesApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getCandidates] rust call failed:', msg);
        recordRustFallback({
            entity: 'candidate',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getCandidateById(
    id: string,
): Promise<CrmCandidateDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_candidate', 'view');
    if (!guard.ok) return null;

    try {
        return await crmCandidatesApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getCandidateById] rust call failed:', msg);
        recordRustFallback({
            entity: 'candidate',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STAGES: ReadonlySet<CrmCandidateStage> = new Set<
    CrmCandidateStage
>([
    'applied',
    'screening',
    'interview',
    'offer',
    'hired',
    'rejected',
    'archived',
]);

const VALID_SOURCES: ReadonlySet<string> = new Set([
    'linkedin',
    'referral',
    'website',
    'agency',
]);

function readPayload(formData: FormData): {
    payload: CrmCandidateCreateInput;
    error?: string;
} {
    const firstName = asString(formData.get('firstName'));
    if (!firstName) {
        return {
            payload: { firstName: '', email: '' },
            error: 'First name is required.',
        };
    }

    const email = asString(formData.get('email'));
    if (!email) {
        return {
            payload: { firstName, email: '' },
            error: 'Email is required.',
        };
    }

    const stageRaw = asString(formData.get('stage'));
    const stage: CrmCandidateStage | undefined =
        stageRaw && VALID_STAGES.has(stageRaw as CrmCandidateStage)
            ? (stageRaw as CrmCandidateStage)
            : undefined;

    const sourceRaw = asString(formData.get('source'));
    const source: CrmCandidateSource | undefined =
        sourceRaw && VALID_SOURCES.has(sourceRaw)
            ? (sourceRaw as CrmCandidateSource)
            : undefined;

    const payload: CrmCandidateCreateInput = {
        firstName,
        lastName: asString(formData.get('lastName')),
        email,
        phone: asString(formData.get('phone')),
        currentCompany: asString(formData.get('currentCompany')),
        currentTitle: asString(formData.get('currentTitle')),
        location: asString(formData.get('location')),
        jobId: asString(formData.get('jobId')),
        resumeUrl: asString(formData.get('resumeUrl')),
        coverLetter: asString(formData.get('coverLetter')),
        skills: asStringList(formData.get('skills')),
        experienceYears: asNumber(formData.get('experienceYears')),
        expectedSalary: asNumber(formData.get('expectedSalary')),
        currency: asString(formData.get('currency')),
        rating: asNumber(formData.get('rating')),
        notes: asString(formData.get('notes')),
        tags: asStringList(formData.get('tags')),
        ...(stage ? { stage } : {}),
        ...(source ? { source } : {}),
    };

    return { payload };
}

export async function saveCandidate(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const candidateId = asString(formData.get('candidateId'));
    const isEditing = !!candidateId;

    const guard = await requirePermission(
        'crm_candidate',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmCandidateUpdateInput = payload;
            const updated = await crmCandidatesApi.update(candidateId!, patch);
            revalidatePath('/dashboard/hrm/hr/candidates');
            revalidatePath(`/dashboard/hrm/hr/candidates/${candidateId}`);
            return {
                message: 'Candidate updated.',
                id: updated?._id ?? candidateId,
            };
        }

        const created = await crmCandidatesApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/candidates');
        return {
            message: 'Candidate created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: errStatus, msg } = rustError(e);
        console.error('[saveCandidate] rust call failed:', msg);
        recordRustFallback({
            entity: 'candidate',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: errStatus,
        });
        return { error: `Failed to save candidate: ${msg}` };
    }
}

export async function deleteCandidate(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Candidate id is required.' };

    const guard = await requirePermission('crm_candidate', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmCandidatesApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/candidates');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteCandidate] rust call failed:', msg);
        recordRustFallback({
            entity: 'candidate',
            op: 'delete',
            errorCode: code,
            status,
        });
        return {
            success: false,
            error: `Failed to delete candidate: ${msg}`,
        };
    }
}
