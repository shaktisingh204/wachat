'use server';

/**
 * CRM HR Onboarding — server-action wrappers around the Rust crate.
 *
 * Mirrors `crm-policies.actions.ts`. The `checklist` field is encoded as
 * a JSON blob in the form so the server action can parse it back into
 * `CrmOnboardingTask[]`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmOnboardingApi,
    type CrmOnboardingCreateInput,
    type CrmOnboardingDoc,
    type CrmOnboardingListParams,
    type CrmOnboardingListResponse,
    type CrmOnboardingStatus,
    type CrmOnboardingTask,
    type CrmOnboardingUpdateInput,
} from '@/lib/rust-client/crm-onboarding';

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

function asChecklist(v: FormDataEntryValue | null): CrmOnboardingTask[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return undefined;
        return parsed.filter(
            (t): t is CrmOnboardingTask =>
                t && typeof t === 'object' && typeof t.title === 'string',
        );
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

export async function getOnboardings(
    filters?: CrmOnboardingListParams,
): Promise<CrmOnboardingListResponse> {
    const empty: CrmOnboardingListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_onboarding', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmOnboardingApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOnboardings] rust call failed:', msg);
        recordRustFallback({
            entity: 'onboarding',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getOnboardingById(
    id: string,
): Promise<CrmOnboardingDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_onboarding', 'view');
    if (!guard.ok) return null;

    try {
        return await crmOnboardingApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOnboardingById] rust call failed:', msg);
        recordRustFallback({
            entity: 'onboarding',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmOnboardingStatus> = new Set<
    CrmOnboardingStatus
>(['pending', 'in_progress', 'completed', 'cancelled', 'archived']);

function readPayload(formData: FormData): {
    payload: CrmOnboardingCreateInput;
    error?: string;
} {
    const employeeName = asString(formData.get('employeeName'));
    const employeeId = asString(formData.get('employeeId'));
    if (!employeeName && !employeeId) {
        return {
            payload: {},
            error: 'Employee name or id is required.',
        };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmOnboardingStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmOnboardingStatus)
            ? (statusRaw as CrmOnboardingStatus)
            : undefined;

    const payload: CrmOnboardingCreateInput = {
        employeeId,
        employeeName,
        candidateId: asString(formData.get('candidateId')),
        jobId: asString(formData.get('jobId')),
        joiningDate: asString(formData.get('joiningDate')),
        buddyId: asString(formData.get('buddyId')),
        managerId: asString(formData.get('managerId')),
        departmentId: asString(formData.get('departmentId')),
        checklist: asChecklist(formData.get('checklist')),
        progress: asNumber(formData.get('progress')),
        notes: asString(formData.get('notes')),
        ...(status ? { status } : {}),
    };

    return { payload };
}

export async function saveOnboarding(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const onboardingId = asString(formData.get('onboardingId'));
    const isEditing = !!onboardingId;

    const guard = await requirePermission(
        'crm_onboarding',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmOnboardingUpdateInput = payload;
            const updated = await crmOnboardingApi.update(onboardingId!, patch);
            revalidatePath('/dashboard/hrm/hr/onboarding');
            revalidatePath(`/dashboard/hrm/hr/onboarding/${onboardingId}`);
            return {
                message: 'Onboarding updated.',
                id: updated?._id ?? onboardingId,
            };
        }

        const created = await crmOnboardingApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/onboarding');
        return {
            message: 'Onboarding created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: errStatus, msg } = rustError(e);
        console.error('[saveOnboarding] rust call failed:', msg);
        recordRustFallback({
            entity: 'onboarding',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: errStatus,
        });
        return { error: `Failed to save onboarding: ${msg}` };
    }
}

export async function deleteOnboarding(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Onboarding id is required.' };

    const guard = await requirePermission('crm_onboarding', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmOnboardingApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/onboarding');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteOnboarding] rust call failed:', msg);
        recordRustFallback({
            entity: 'onboarding',
            op: 'delete',
            errorCode: code,
            status,
        });
        return {
            success: false,
            error: `Failed to delete onboarding: ${msg}`,
        };
    }
}

/* ─── KPI ─────────────────────────────────────────────────────────────── */

interface OnboardingKpis {
    total: number;
    inProgress: number;
    completedThisMonth: number;
    avgCompletionDays: number;
}

export async function getOnboardingKpis(): Promise<OnboardingKpis> {
    const empty: OnboardingKpis = {
        total: 0,
        inProgress: 0,
        completedThisMonth: 0,
        avgCompletionDays: 0,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_onboarding', 'view');
    if (!guard.ok) return empty;

    try {
        const res = await crmOnboardingApi.list({ limit: 500 });
        const items = res.items ?? [];

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const inProgress = items.filter((o) => o.status === 'in_progress').length;

        const completedThisMonth = items.filter((o) => {
            if (o.status !== 'completed') return false;
            const d = o.completedAt ? new Date(o.completedAt) : null;
            return d && d >= startOfMonth;
        }).length;

        const durations = items
            .filter((o) => o.status === 'completed' && o.joiningDate && o.completedAt)
            .map((o) => {
                const start = new Date(o.joiningDate!).getTime();
                const end = new Date(o.completedAt!).getTime();
                const diff = (end - start) / 86_400_000;
                return Number.isFinite(diff) && diff >= 0 ? diff : null;
            })
            .filter((d): d is number => d !== null);

        const avgCompletionDays =
            durations.length > 0
                ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                : 0;

        return { total: items.length, inProgress, completedThisMonth, avgCompletionDays };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOnboardingKpis] rust call failed:', msg);
        recordRustFallback({ entity: 'onboarding', op: 'list', errorCode: code, status });
        return empty;
    }
}

/* ─── Bulk ────────────────────────────────────────────────────────────── */

export async function bulkCompleteOnboardings(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_onboarding', 'edit');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmOnboardingApi.update(id, {
                status: 'completed',
                progress: 100,
            });
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/onboarding');
    return { succeeded, failed };
}

export async function bulkDeleteOnboardings(
    ids: string[],
): Promise<{ succeeded: number; failed: number }> {
    const session = await getSession();
    if (!session?.user) return { succeeded: 0, failed: ids.length };

    const guard = await requirePermission('crm_onboarding', 'delete');
    if (!guard.ok) return { succeeded: 0, failed: ids.length };

    let succeeded = 0;
    let failed = 0;

    for (const id of ids) {
        try {
            await crmOnboardingApi.delete(id);
            succeeded++;
        } catch {
            failed++;
        }
    }

    if (succeeded > 0) revalidatePath('/dashboard/crm/hr/onboarding');
    return { succeeded, failed };
}
