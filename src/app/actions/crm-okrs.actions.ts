'use server';

/**
 * CRM HR OKRs — server-action wrappers around the Rust crate.
 *
 * Delegates to `crmOkrsApi` (Rust `/v1/crm/okrs`). On failure we record a
 * fallback telemetry event and return `{ error }` — there is no Mongo
 * shadow read. Field shape mirrors the Rust DTO (camelCase).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmOkrsApi,
    type CrmOkrCreateInput,
    type CrmOkrDoc,
    type CrmOkrKeyResult,
    type CrmOkrKeyResultStatus,
    type CrmOkrListParams,
    type CrmOkrListResponse,
    type CrmOkrStatus,
    type CrmOkrUpdateInput,
} from '@/lib/rust-client/crm-okrs';

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

function asTags(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const tags = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return tags.length > 0 ? tags : undefined;
}

function asKeyResults(v: FormDataEntryValue | null): CrmOkrKeyResult[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    try {
        const parsed = JSON.parse(s);
        if (!Array.isArray(parsed)) return undefined;
        const out: CrmOkrKeyResult[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== 'object') continue;
            const o = item as Record<string, unknown>;
            const title = typeof o.title === 'string' ? o.title.trim() : '';
            if (!title) continue;
            const status = (
                typeof o.status === 'string' &&
                ['on_track', 'at_risk', 'behind', 'completed'].includes(o.status)
                    ? o.status
                    : 'on_track'
            ) as CrmOkrKeyResultStatus;
            const kr: CrmOkrKeyResult = {
                id: typeof o.id === 'string' && o.id ? o.id : `kr_${Math.random().toString(36).slice(2, 10)}`,
                title,
                status,
            };
            if (typeof o.metric === 'string' && o.metric) kr.metric = o.metric;
            if (typeof o.unit === 'string' && o.unit) kr.unit = o.unit;
            const tgt = typeof o.targetValue === 'number' ? o.targetValue : Number(o.targetValue);
            if (Number.isFinite(tgt)) kr.targetValue = tgt;
            const cur = typeof o.currentValue === 'number' ? o.currentValue : Number(o.currentValue);
            if (Number.isFinite(cur)) kr.currentValue = cur;
            const w = typeof o.weight === 'number' ? o.weight : Number(o.weight);
            if (Number.isFinite(w)) kr.weight = w;
            out.push(kr);
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

/**
 * List OKRs for the active session. Returns an empty list response on any
 * failure so the page can render its empty state rather than crash.
 */
export async function getOkrs(
    filters?: CrmOkrListParams,
): Promise<CrmOkrListResponse> {
    const empty: CrmOkrListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_okr', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmOkrsApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOkrs] rust call failed:', msg);
        recordRustFallback({
            entity: 'okr',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getOkrById(id: string): Promise<CrmOkrDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_okr', 'view');
    if (!guard.ok) return null;

    try {
        return await crmOkrsApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOkrById] rust call failed:', msg);
        recordRustFallback({
            entity: 'okr',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmOkrStatus> = new Set<CrmOkrStatus>([
    'draft',
    'in_progress',
    'on_track',
    'at_risk',
    'behind',
    'completed',
    'missed',
    'archived',
]);

function readPayload(formData: FormData): {
    payload: CrmOkrCreateInput;
    error?: string;
} {
    const objective = asString(formData.get('objective'));
    if (!objective) {
        return { payload: {} as CrmOkrCreateInput, error: 'Objective is required.' };
    }

    const statusRaw = asString(formData.get('status'));
    const status: CrmOkrStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmOkrStatus)
            ? (statusRaw as CrmOkrStatus)
            : undefined;

    const payload: CrmOkrCreateInput = {
        objective,
        description: asString(formData.get('description')),
        period: asString(formData.get('period')),
        ownerId: asString(formData.get('ownerId')),
        ownerName: asString(formData.get('ownerName')),
        teamId: asString(formData.get('teamId')),
        departmentId: asString(formData.get('departmentId')),
        parentOkrId: asString(formData.get('parentOkrId')),
        keyResults: asKeyResults(formData.get('keyResults')),
        progress: asNumber(formData.get('progress')),
        confidence: asNumber(formData.get('confidence')),
        startDate: asString(formData.get('startDate')),
        endDate: asString(formData.get('endDate')),
        tags: asTags(formData.get('tags')),
        ...(status ? { status } : {}),
    };

    return { payload };
}

/**
 * Create or update an OKR. If `okrId` is present we PATCH; otherwise we
 * POST. Returns the canonical `{ message, error, id }` shape consumed by
 * `useActionState`.
 */
export async function saveOkr(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const okrId = asString(formData.get('okrId'));
    const isEditing = !!okrId;

    const guard = await requirePermission(
        'crm_okr',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmOkrUpdateInput = payload;
            const updated = await crmOkrsApi.update(okrId!, patch);
            revalidatePath('/dashboard/hrm/hr/okrs');
            revalidatePath(`/dashboard/hrm/hr/okrs/${okrId}`);
            return {
                message: 'OKR updated.',
                id: updated?._id ?? okrId,
            };
        }

        const created = await crmOkrsApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/okrs');
        return {
            message: 'OKR created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[saveOkr] rust call failed:', msg);
        recordRustFallback({
            entity: 'okr',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save OKR: ${msg}` };
    }
}

export async function deleteOkr(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'OKR id is required.' };

    const guard = await requirePermission('crm_okr', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmOkrsApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/okrs');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteOkr] rust call failed:', msg);
        recordRustFallback({
            entity: 'okr',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete OKR: ${msg}` };
    }
}

/* ─── Bulk actions (§1D Deep-list template) ──────────────────────────── */

/**
 * Bulk-delete OKRs via the Rust BFF. The BFF has no batch endpoint so
 * we loop single-deletes; each delete is tenant-guarded by the session.
 */
export async function bulkDeleteOkrs(
    ids: string[],
): Promise<{ success: boolean; deleted: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, deleted: 0, error: 'Access denied.' };
    }
    const guard = await requirePermission('crm_okr', 'delete');
    if (!guard.ok) return { success: false, deleted: 0, error: guard.error };

    let deleted = 0;
    const filtered = ids.filter(Boolean);
    for (const id of filtered) {
        try {
            const r = await crmOkrsApi.delete(id);
            if (r?.deleted) deleted += 1;
        } catch (e) {
            const { code, status } = rustError(e);
            recordRustFallback({
                entity: 'okr',
                op: 'delete',
                errorCode: code,
                status,
            });
        }
    }
    revalidatePath('/dashboard/crm/hr/okrs');
    revalidatePath('/dashboard/hrm/hr/okrs');
    return { success: true, deleted };
}

/**
 * Bulk-archive OKRs by flipping each to status="archived" via the Rust
 * update endpoint. Mirrors the soft-archive semantic used elsewhere.
 */
export async function bulkArchiveOkrs(
    ids: string[],
): Promise<{ success: boolean; archived: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, archived: 0, error: 'Access denied.' };
    }
    const guard = await requirePermission('crm_okr', 'edit');
    if (!guard.ok) return { success: false, archived: 0, error: guard.error };

    let archived = 0;
    for (const id of ids.filter(Boolean)) {
        try {
            await crmOkrsApi.update(id, { status: 'archived' });
            archived += 1;
        } catch (e) {
            const { code, status } = rustError(e);
            recordRustFallback({
                entity: 'okr',
                op: 'update',
                errorCode: code,
                status,
            });
        }
    }
    revalidatePath('/dashboard/crm/hr/okrs');
    revalidatePath('/dashboard/hrm/hr/okrs');
    return { success: true, archived };
}
