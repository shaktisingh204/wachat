'use server';

/**
 * CRM Expense Category server actions.
 *
 * Thin shims over the Rust BFF (`crmExpenseCategoriesApi`). No direct Mongo
 * access — this entity is Rust-only. RBAC key: `crm_expense_category`.
 * Observability is forwarded through `recordRustFallback` so the dashboard
 * can correlate spikes in Rust-side errors.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
    crmExpenseCategoriesApi,
    type CrmExpenseCategoryCreateInput,
    type CrmExpenseCategoryDoc,
    type CrmExpenseCategoryListParams,
    type CrmExpenseCategoryUpdateInput,
} from '@/lib/rust-client/crm-expense-categories';

const LIST_PATH = '/dashboard/crm/settings/expense-categories';
const ENTITY_KIND = 'expense_category';
const RBAC_KEY = 'crm_expense_category';

/* ─── Helpers ─────────────────────────────────────────────────── */

function rustErr(e: unknown): string {
    if (e instanceof RustApiError) return e.message;
    if (e instanceof Error) return e.message;
    return 'Unexpected error.';
}

function recordFallback(op: 'list' | 'get' | 'create' | 'update' | 'delete', e: unknown) {
    recordRustFallback({
        entity: ENTITY_KIND,
        op,
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
    });
}

function pickString(formData: FormData, key: string): string | undefined {
    const v = formData.get(key);
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
    const v = formData.get(key);
    if (typeof v !== 'string' || v.trim() === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}

function pickBool(formData: FormData, key: string): boolean {
    const v = formData.get(key);
    if (typeof v !== 'string') return false;
    const t = v.trim().toLowerCase();
    return t === 'on' || t === 'true' || t === '1' || t === 'yes';
}

/* ─── Read ────────────────────────────────────────────────────── */

/**
 * List every expense category for the current tenant.
 *
 * The settings page renders the full list in a single table, so this
 * helper pages through the Rust endpoint until `hasMore === false`. A
 * hard ceiling (10 pages of 100 → 1 000 rows) prevents runaway loops if
 * the backend ever returns a stale `hasMore` flag.
 */
export async function getExpenseCategories(
    params: CrmExpenseCategoryListParams = {},
): Promise<CrmExpenseCategoryDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const limit = Math.min(Math.max(1, params.limit ?? 100), 100);
    const acc: CrmExpenseCategoryDoc[] = [];

    try {
        for (let page = params.page ?? 1, guard = 0; guard < 10; page += 1, guard += 1) {
            const res = await crmExpenseCategoriesApi.list({ ...params, page, limit });
            acc.push(...res.items);
            if (!res.hasMore) break;
        }
        return acc;
    } catch (e) {
        console.error('[getExpenseCategories] rust path failed:', e);
        recordFallback('list', e);
        return acc;
    }
}

export async function getExpenseCategoryById(
    id: string,
): Promise<CrmExpenseCategoryDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    try {
        return await crmExpenseCategoriesApi.getById(id);
    } catch (e) {
        if (e instanceof RustApiError && e.status === 404) return null;
        console.error('[getExpenseCategoryById] rust path failed:', e);
        recordFallback('get', e);
        return null;
    }
}

/* ─── Write ───────────────────────────────────────────────────── */

/**
 * Create-or-update entry point for the dialog form. Detects edit mode
 * by the presence of `_id` (the convention the page uses for hidden
 * inputs). On success we revalidate the list page so the table
 * re-fetches via the server action.
 */
export async function saveExpenseCategory(
    _prev: unknown,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const id = pickString(formData, '_id');
    const isEditing = !!id;

    const guard = await requirePermission(RBAC_KEY, isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const name = pickString(formData, 'name');
    if (!name) return { error: 'Category name is required.' };

    const payload: CrmExpenseCategoryCreateInput = {
        name,
        code: pickString(formData, 'code'),
        parentId: pickString(formData, 'parentId'),
        description: pickString(formData, 'description'),
        defaultAccountId: pickString(formData, 'defaultAccountId'),
        taxRate: pickNumber(formData, 'taxRate'),
        isBillable: pickBool(formData, 'isBillable'),
        isReimbursable: pickBool(formData, 'isReimbursable'),
        maxAmount: pickNumber(formData, 'maxAmount'),
        requiresReceiptAbove: pickNumber(formData, 'requiresReceiptAbove'),
        color: pickString(formData, 'color'),
        icon: pickString(formData, 'icon'),
        isActive: pickBool(formData, 'isActive'),
    };

    try {
        let savedId: string;
        if (isEditing && id) {
            const patch: CrmExpenseCategoryUpdateInput = { ...payload };
            const updated = await crmExpenseCategoriesApi.update(id, patch);
            savedId = String(updated._id);
        } else {
            const created = await crmExpenseCategoriesApi.create(payload);
            savedId = String(created.id);
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: isEditing ? 'update' : 'create',
                entityKind: ENTITY_KIND,
                entityId: savedId,
                reason: name,
            });
        } catch {
            /* audit is best-effort */
        }

        revalidatePath(LIST_PATH);
        return {
            message: isEditing
                ? 'Expense category updated.'
                : 'Expense category created.',
            id: savedId,
        };
    } catch (e) {
        console.error('[saveExpenseCategory] rust path failed:', e);
        recordFallback(isEditing ? 'update' : 'create', e);
        return { error: rustErr(e) };
    }
}

/* ─── Bulk actions ────────────────────────────────────────────────────── */

type BulkResult = { ok: true; count: number } | { ok: false; error: string };

export async function bulkDeleteExpenseCategories(ids: string[]): Promise<BulkResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied' };
    if (ids.length === 0) return { ok: false, error: 'No categories selected.' };

    const guard = await requirePermission(RBAC_KEY, 'delete');
    if (!guard.ok) return { ok: false, error: guard.error };

    let count = 0;
    for (const id of ids) {
        try {
            await crmExpenseCategoriesApi.delete(id);
            count++;
        } catch (e) {
            if (e instanceof RustApiError && e.status === 404) continue;
            console.error(`[bulkDeleteExpenseCategories] failed for ${id}:`, e);
            recordFallback('delete', e);
        }
    }
    revalidatePath(LIST_PATH);
    return { ok: true, count };
}

async function bulkSetExpenseCategoryStatus(
    ids: string[],
    isActive: boolean,
): Promise<BulkResult> {
    const session = await getSession();
    if (!session?.user) return { ok: false, error: 'Access denied' };
    if (ids.length === 0) return { ok: false, error: 'No categories selected.' };

    const guard = await requirePermission(RBAC_KEY, 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    let count = 0;
    for (const id of ids) {
        try {
            await crmExpenseCategoriesApi.update(id, { isActive });
            count++;
        } catch (e) {
            console.error(`[bulkSetExpenseCategoryStatus] failed for ${id}:`, e);
            recordFallback('update', e);
        }
    }
    revalidatePath(LIST_PATH);
    return { ok: true, count };
}

export async function bulkActivateExpenseCategories(ids: string[]): Promise<BulkResult> {
    return bulkSetExpenseCategoryStatus(ids, true);
}

export async function bulkDeactivateExpenseCategories(ids: string[]): Promise<BulkResult> {
    return bulkSetExpenseCategoryStatus(ids, false);
}

export async function deleteExpenseCategory(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    if (!id) return { success: false, error: 'Invalid category id.' };

    const guard = await requirePermission(RBAC_KEY, 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        await crmExpenseCategoriesApi.delete(id);
        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'delete',
                entityKind: ENTITY_KIND,
                entityId: id,
            });
        } catch {
            /* audit is best-effort */
        }
        revalidatePath(LIST_PATH);
        return { success: true };
    } catch (e) {
        if (e instanceof RustApiError && e.status === 404) {
            return { success: false, error: 'Expense category not found.' };
        }
        console.error('[deleteExpenseCategory] rust path failed:', e);
        recordFallback('delete', e);
        return { success: false, error: rustErr(e) };
    }
}
