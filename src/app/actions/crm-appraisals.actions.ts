'use server';

/**
 * CRM Appraisal Reviews — Rust-backed server actions for the
 * /dashboard/hrm/payroll/appraisal-reviews entity.
 *
 * Delegates entirely to `crmAppraisalsApi`. Field shape mirrors the
 * Rust DTO (`rust/crates/crm-appraisals/src/dto.rs`).
 *
 * Fields: employeeName, employeeId, reviewer, period,
 *   kpis (Vec<{name, target, achieved, score}> repeater),
 *   overallRating (1..5), comments, status, finalizedAt.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmAppraisalsApi,
    type CrmAppraisalCreateInput,
    type CrmAppraisalKpi,
    type CrmAppraisalListParams,
    type CrmAppraisalListResponse,
    type CrmAppraisalReviewDoc,
    type CrmAppraisalStatus,
    type CrmAppraisalUpdateInput,
} from '@/lib/rust-client/crm-appraisals';

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

const VALID_STATUSES: ReadonlySet<CrmAppraisalStatus> = new Set<
    CrmAppraisalStatus
>(['draft', 'submitted', 'finalized', 'archived']);

/**
 * Parse a JSON-serialised KPI repeater payload. Drops invalid rows
 * silently — the form is responsible for validation, but we still
 * defensively guard so a malformed POST can't crash the server.
 */
function parseKpisJson(raw: string | null | undefined): CrmAppraisalKpi[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((row) => {
                if (!row || typeof row !== 'object') return null;
                const rec = row as Record<string, unknown>;
                const name =
                    typeof rec.name === 'string' ? rec.name.trim() : '';
                if (!name) return null;
                const out: CrmAppraisalKpi = { name };
                if (rec.kpiId && typeof rec.kpiId === 'string') {
                    out.kpiId = rec.kpiId.trim();
                }
                const target = Number(rec.target);
                if (Number.isFinite(target)) out.target = target;
                const achieved = Number(rec.achieved);
                if (Number.isFinite(achieved)) out.achieved = achieved;
                const score = Number(rec.score);
                if (Number.isFinite(score)) out.score = score;
                return out;
            })
            .filter((k): k is CrmAppraisalKpi => !!k);
    } catch {
        return [];
    }
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getAppraisalReviewsList(
    filters?: CrmAppraisalListParams,
): Promise<CrmAppraisalListResponse> {
    const empty: CrmAppraisalListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_payroll', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmAppraisalsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getAppraisalReviewsList] rust call failed:', msg);
        recordRustFallback({
            entity: 'appraisal',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getAppraisalReviewDoc(
    id: string,
): Promise<CrmAppraisalReviewDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_payroll', 'view');
    if (!guard.ok) return null;

    try {
        return await crmAppraisalsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getAppraisalReviewDoc] rust call failed:', msg);
        recordRustFallback({
            entity: 'appraisal',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

function readPayload(formData: FormData): {
    payload: CrmAppraisalCreateInput;
    status?: CrmAppraisalStatus;
    error?: string;
} {
    const employeeName = asString(formData.get('employeeName'));
    if (!employeeName) {
        return {
            payload: {} as CrmAppraisalCreateInput,
            error: 'Employee name is required.',
        };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmAppraisalStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmAppraisalStatus)
            ? (statusRaw as CrmAppraisalStatus)
            : undefined;

    const kpis = parseKpisJson(formData.get('kpis') as string | null);

    const overallRatingRaw = asNumber(formData.get('overallRating'));
    const overallRating =
        overallRatingRaw == null
            ? undefined
            : Math.max(1, Math.min(5, overallRatingRaw));

    const payload: CrmAppraisalCreateInput = {
        employeeName,
        employeeId: asString(formData.get('employeeId')),
        reviewer: asString(formData.get('reviewer')),
        period: asString(formData.get('period')),
        kpis,
        overallRating,
        comments: asString(formData.get('comments')),
        ...(status ? { status } : {}),
    };

    return { payload, status };
}

export async function saveAppraisalReview(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const reviewId = asString(formData.get('reviewId'));
    const isEditing = !!reviewId;

    const guard = await requirePermission(
        'crm_payroll',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, status, error } = readPayload(formData);
    if (error) return { error };

    const finalizedAt = asString(formData.get('finalizedAt'));

    try {
        if (isEditing) {
            const patch: CrmAppraisalUpdateInput = {
                ...payload,
                ...(status ? { status } : {}),
                ...(finalizedAt ? { finalizedAt } : {}),
            };
            const updated = await crmAppraisalsApi.update(reviewId!, patch);
            revalidatePath('/dashboard/hrm/payroll/appraisal-reviews');
            revalidatePath(`/dashboard/hrm/payroll/appraisal-reviews/${reviewId}`);
            return {
                message: 'Appraisal review updated.',
                id: updated?._id ?? reviewId,
            };
        }

        const created = await crmAppraisalsApi.create(payload);
        // `finalizedAt` is an update-only field on the Rust side — patch
        // immediately after create if the form provided one.
        if (finalizedAt && created?.id) {
            try {
                await crmAppraisalsApi.update(created.id, { finalizedAt });
            } catch (e) {
                console.error(
                    '[saveAppraisalReview] failed to attach finalizedAt after create:',
                    e,
                );
            }
        }
        revalidatePath('/dashboard/hrm/payroll/appraisal-reviews');
        return {
            message: 'Appraisal review created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: httpStatus, msg } = rustError(e);
        console.error('[saveAppraisalReview] rust call failed:', msg);
        recordRustFallback({
            entity: 'appraisal',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: httpStatus,
        });
        return { error: `Failed to save review: ${msg}` };
    }
}

export async function finalizeAppraisalReview(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Review id is required.' };

    const guard = await requirePermission('crm_payroll', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        await crmAppraisalsApi.update(id, {
            status: 'finalized',
            finalizedAt: new Date().toISOString(),
        });
        revalidatePath('/dashboard/hrm/payroll/appraisal-reviews');
        revalidatePath(`/dashboard/hrm/payroll/appraisal-reviews/${id}`);
        return { success: true };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[finalizeAppraisalReview] rust call failed:', msg);
        recordRustFallback({
            entity: 'appraisal',
            op: 'update',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to finalize: ${msg}` };
    }
}

export async function deleteAppraisalReview(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Review id is required.' };

    const guard = await requirePermission('crm_payroll', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmAppraisalsApi.delete(id);
        revalidatePath('/dashboard/hrm/payroll/appraisal-reviews');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteAppraisalReview] rust call failed:', msg);
        recordRustFallback({
            entity: 'appraisal',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete: ${msg}` };
    }
}
