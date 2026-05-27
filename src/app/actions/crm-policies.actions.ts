'use server';

/**
 * CRM HR Policies — server-action wrappers around the Rust crate.
 *
 * This entity is NEW (no legacy Mongo `crm_policies` collection), so every
 * code-path delegates to `crmPoliciesApi`. On Rust failure we record a
 * fallback telemetry event and return `{ error }` — there is no Mongo
 * shadow read to fall back to.
 *
 * Field shape mirrors the Rust DTO (`rust/crates/crm-policies/src/dto.rs`)
 * which serialises with `rename_all = "camelCase"`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmPoliciesApi,
    type CrmPolicyCreateInput,
    type CrmPolicyDoc,
    type CrmPolicyListParams,
    type CrmPolicyListResponse,
    type CrmPolicyStatus,
    type CrmPolicyUpdateInput,
} from '@/lib/rust-client/crm-policies';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes';
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

/**
 * Fetch the list of policies for the active session.
 *
 * Filters map straight onto the Rust list endpoint. On any failure we
 * return an empty list response so the page can render its empty state
 * rather than crash.
 */
export async function getPolicies(
    filters?: CrmPolicyListParams,
): Promise<CrmPolicyListResponse> {
    const empty: CrmPolicyListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_policy', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmPoliciesApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getPolicies] rust call failed:', msg);
        recordRustFallback({
            entity: 'policy',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

/**
 * Fetch a single policy document by id.
 */
export async function getPolicyById(id: string): Promise<CrmPolicyDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_policy', 'view');
    if (!guard.ok) return null;

    try {
        return await crmPoliciesApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getPolicyById] rust call failed:', msg);
        recordRustFallback({
            entity: 'policy',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmPolicyStatus> = new Set<CrmPolicyStatus>([
    'draft',
    'published',
    'under_review',
    'archived',
    'obsolete',
]);

function readPayload(formData: FormData): {
    payload: CrmPolicyCreateInput;
    error?: string;
} {
    const name = asString(formData.get('name'));
    if (!name) return { payload: {} as CrmPolicyCreateInput, error: 'Name is required.' };

    const statusRaw = asString(formData.get('status'));
    const status: CrmPolicyStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmPolicyStatus)
            ? (statusRaw as CrmPolicyStatus)
            : undefined;

    // The Rust crate accepts a single combined `content` field for the
    // markdown body. We accept either `content` or `contentMarkdown` from
    // the form so callers can use whichever name reads better.
    const content =
        asString(formData.get('content')) ??
        asString(formData.get('contentMarkdown'));

    const payload: CrmPolicyCreateInput = {
        name,
        version: asString(formData.get('version')),
        category: asString(formData.get('category')),
        summary: asString(formData.get('summary')),
        documentUrl: asString(formData.get('documentUrl')),
        content,
        effectiveDate: asString(formData.get('effectiveDate')),
        reviewDate: asString(formData.get('reviewDate')),
        expiryDate: asString(formData.get('expiryDate')),
        ownerId: asString(formData.get('ownerId')),
        acknowledgementRequired: asBool(formData.get('requireAcknowledgement')),
        tags: asTags(formData.get('tags')),
        ...(status ? { status } : {}),
    };

    return { payload };
}

/**
 * Create or update a policy. If `policyId` is supplied (hidden form
 * field) we PATCH, otherwise we POST. Returns the canonical
 * `{ message, error, id }` shape consumed by `useActionState`.
 */
export async function savePolicy(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const policyId = asString(formData.get('policyId'));
    const isEditing = !!policyId;

    const guard = await requirePermission(
        'crm_policy',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    try {
        if (isEditing) {
            const patch: CrmPolicyUpdateInput = payload;
            const updated = await crmPoliciesApi.update(policyId!, patch);
            revalidatePath('/dashboard/hrm/hr/policies');
            revalidatePath(`/dashboard/hrm/hr/policies/${policyId}`);
            return {
                message: 'Policy updated.',
                id: updated?._id ?? policyId,
            };
        }

        const created = await crmPoliciesApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/policies');
        return {
            message: 'Policy created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[savePolicy] rust call failed:', msg);
        recordRustFallback({
            entity: 'policy',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status,
        });
        return { error: `Failed to save policy: ${msg}` };
    }
}

/**
 * Soft-delete a policy. We prefer the explicit DELETE endpoint exposed
 * by the Rust crate; the crate handles the "soft-delete vs hard-delete"
 * decision server-side based on its own configuration.
 */
export async function deletePolicy(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Policy id is required.' };

    const guard = await requirePermission('crm_policy', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmPoliciesApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/policies');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deletePolicy] rust call failed:', msg);
        recordRustFallback({
            entity: 'policy',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete policy: ${msg}` };
    }
}

/* ─── Bulk & KPIs (§1D Deep template) ────────────────────────────────── */

interface CrmPolicyKpis {
    total: number;
    published: number;
    drafts: number;
    lastUpdatedAt?: string;
    acknowledged: number;
}

/**
 * Aggregate top-line KPI counts for the policies list page.
 *
 * Cheap derivation: pull every tenant-visible policy via the regular list
 * endpoint (already RBAC-guarded) and roll counts client-side. Falls back
 * to zeros on failure so the KPI strip degrades gracefully.
 */
export async function getPolicyKpis(): Promise<CrmPolicyKpis> {
    const empty: CrmPolicyKpis = {
        total: 0,
        published: 0,
        drafts: 0,
        acknowledged: 0,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_policy', 'view');
    if (!guard.ok) return empty;

    try {
        const res = await crmPoliciesApi.list({ limit: 500 });
        const items = res.items ?? [];
        let published = 0;
        let drafts = 0;
        let acknowledged = 0;
        let lastUpdatedAt: string | undefined;
        for (const p of items) {
            if (p.status === 'published') published += 1;
            else if (p.status === 'draft') drafts += 1;
            const ackCount = Number(p.acknowledgementCount ?? 0);
            if (Number.isFinite(ackCount) && ackCount > 0) acknowledged += ackCount;
            const updated = p.updatedAt ? Date.parse(p.updatedAt) : NaN;
            if (Number.isFinite(updated)) {
                const prev = lastUpdatedAt ? Date.parse(lastUpdatedAt) : 0;
                if (updated > prev) lastUpdatedAt = p.updatedAt;
            }
        }
        return {
            total: items.length,
            published,
            drafts,
            lastUpdatedAt,
            acknowledged,
        };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getPolicyKpis] rust call failed:', msg);
        recordRustFallback({
            entity: 'policy',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

type CrmPolicyBulkOp = 'delete' | 'archive' | 'publish';

interface CrmPolicyBulkResult {
    success: boolean;
    affected: number;
    error?: string;
}

/**
 * Apply a bulk operation across a set of policy ids in the same tenant.
 *
 * `delete`   — soft-delete via the Rust crate's DELETE endpoint
 * `archive`  — patch status → "archived"
 * `publish`  — patch status → "published"
 *
 * Errors per id are swallowed so the caller gets a best-effort count.
 */
export async function bulkPolicyAction(
    ids: string[],
    op: CrmPolicyBulkOp,
): Promise<CrmPolicyBulkResult> {
    const session = await getSession();
    if (!session?.user) return { success: false, affected: 0, error: 'Access denied.' };
    if (!Array.isArray(ids) || ids.length === 0) {
        return { success: true, affected: 0 };
    }

    const action = op === 'delete' ? 'delete' : 'edit';
    const guard = await requirePermission('crm_policy', action);
    if (!guard.ok) return { success: false, affected: 0, error: guard.error };

    let affected = 0;
    for (const id of ids) {
        if (!id) continue;
        try {
            if (op === 'delete') {
                const r = await crmPoliciesApi.delete(id);
                if (r?.deleted) affected += 1;
            } else {
                const nextStatus: CrmPolicyStatus =
                    op === 'archive' ? 'archived' : 'published';
                await crmPoliciesApi.update(id, { status: nextStatus });
                affected += 1;
            }
        } catch (e) {
            const { msg } = rustError(e);
            console.error(`[bulkPolicyAction] ${op} ${id} failed:`, msg);
        }
    }

    revalidatePath('/dashboard/hrm/hr/policies');
    revalidatePath('/dashboard/crm/hr/policies');
    return { success: true, affected };
}
