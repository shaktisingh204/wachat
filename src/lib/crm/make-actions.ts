'use server';
/**
 * Generic Next.js server-actions factory for any CRM entity that follows
 * the standard `/v1/crm/<entity>` route shape from `docs/ecosystem/CRM_PLAN.md`
 * §A4 / §2.4.
 *
 * Wraps a `CrmClient` (from `@/lib/rust-client/crm-base`) and emits the five
 * canonical server actions every entity needs:
 *
 *   saveEntity(FormData)        — create
 *   updateEntity(id, FormData)  — partial update
 *   deleteEntity(id)            — delete
 *   getEntityById(id)           — single hydrate
 *   listEntities(params)        — list
 *
 * Each mutation runs `getSession()` + `requirePermission()` first, calls
 * the rust client, fires a best-effort audit-log write, and revalidates
 * the entity's dashboard path.
 *
 * Audit failures and revalidate failures NEVER unwind the user's mutation.
 */

import 'server-only';

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry, type AuditAction } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import type {
    CrmClient,
    CrmCreateResult,
    CrmListParams,
    CrmListResult,
} from '@/lib/rust-client/crm-base';
import { RustApiError } from '@/lib/rust-client/fetcher';

/* ─── Public types ───────────────────────────────────────────────────── */

interface CrmActionResult {
    message?: string;
    error?: string;
    code?: string;
    id?: string;
}

interface MakeCrmActionsOptions<TEntity, TDraft> {
    /** The CrmClient instance built via makeCrmClient(). */
    client: CrmClient<TEntity, TDraft>;
    /**
     * Path to revalidate after each mutation
     * (e.g. '/dashboard/crm/sales/quotations').
     */
    revalidatePath: string;
    /**
     * RBAC moduleKey for `requirePermission(moduleKey, action)`.
     * Example: 'crm_invoice'.
     */
    permission: string;
    /**
     * Audit-log entity_kind, e.g. 'invoice'. Becomes the `entityKind`
     * field on every audit row.
     */
    entityKind: string;
    /**
     * Convert FormData → TDraft. Throws on validation failure. Errors are
     * caught and returned as `{ error: e.message }`.
     */
    parseFormData: (formData: FormData) => TDraft;
}

interface CrmActions<TEntity, TDraft> {
    saveEntity(formData: FormData): Promise<CrmActionResult>;
    updateEntity(id: string, formData: FormData): Promise<CrmActionResult>;
    deleteEntity(id: string): Promise<CrmActionResult>;
    getEntityById(id: string): Promise<TEntity | null>;
    listEntities(params?: CrmListParams): Promise<CrmListResult<TEntity>>;
}

/* ─── Internals ──────────────────────────────────────────────────────── */

async function safeAudit(
    tenantUserId: string,
    actorId: string,
    entityKind: string,
    entityId: string,
    action: AuditAction,
    diff?: Record<string, { before?: unknown; after?: unknown }>,
): Promise<void> {
    try {
        await writeAuditEntry({
            tenantUserId,
            actorId,
            action,
            entityKind,
            entityId,
            diff,
        });
    } catch (e) {
        console.error('[makeCrmActions] audit write failed:', e);
    }
}

function safeRevalidate(path: string): void {
    try {
        revalidatePath(path);
    } catch (e) {
        console.error('[makeCrmActions] revalidatePath failed:', e);
    }
}

function describeError(e: unknown): { error: string; code?: string } {
    if (e instanceof RustApiError) {
        return { error: e.message || 'Rust API error', code: e.code };
    }
    if (e instanceof Error) {
        return { error: e.message };
    }
    return { error: 'Unknown error' };
}

/* ─── Public factory ─────────────────────────────────────────────────── */

/**
 * Build the five canonical server actions for a CRM entity.
 *
 * Permission action mapping (matches `src/lib/rbac-server.ts`):
 *   saveEntity     → 'create'
 *   updateEntity   → 'edit'
 *   deleteEntity   → 'delete'
 *   getEntityById  → 'view'
 *   listEntities   → 'view'
 *
 * @example
 *   const accountClient = makeCrmClient<AccountDoc, AccountDraft>('/v1/crm/accounts');
 *   export const { saveEntity, updateEntity, deleteEntity, getEntityById, listEntities } =
 *     makeCrmActions<AccountDoc, AccountDraft>({
 *       client: accountClient,
 *       revalidatePath: '/dashboard/crm/sales/clients',
 *       permission: 'crm_account',
 *       entityKind: 'account',
 *       parseFormData: parseAccountForm,
 *     });
 */
export function makeCrmActions<TEntity, TDraft>(
    opts: MakeCrmActionsOptions<TEntity, TDraft>,
): CrmActions<TEntity, TDraft> {
    const { client, revalidatePath: revalPath, permission, entityKind, parseFormData } = opts;

    async function saveEntity(formData: FormData): Promise<CrmActionResult> {
        const session = await getSession();
        if (!session?.user?._id) {
            return { error: 'Unauthorized' };
        }
        const guard = await requirePermission(permission, 'create');
        if (!guard.ok) {
            return { error: guard.error };
        }

        let draft: TDraft;
        try {
            draft = parseFormData(formData);
        } catch (e) {
            return describeError(e);
        }

        try {
            const result: CrmCreateResult<TEntity> = await client.create(draft);
            if (!result.id) {
                return { error: 'Create succeeded but response did not include id.' };
            }
            await safeAudit(
                String(session.user._id),
                String(session.user._id),
                entityKind,
                result.id,
                'create',
                { entity: { after: result.entity } },
            );
            safeRevalidate(revalPath);
            return { id: result.id, message: 'Created successfully.' };
        } catch (e) {
            return describeError(e);
        }
    }

    async function updateEntity(id: string, formData: FormData): Promise<CrmActionResult> {
        if (!id) return { error: 'Missing id' };

        const session = await getSession();
        if (!session?.user?._id) {
            return { error: 'Unauthorized' };
        }
        const guard = await requirePermission(permission, 'edit');
        if (!guard.ok) {
            return { error: guard.error };
        }

        let patch: TDraft;
        try {
            patch = parseFormData(formData);
        } catch (e) {
            return describeError(e);
        }

        let before: TEntity | null = null;
        try {
            before = await client.getById(id);
        } catch {
            // Best-effort — proceed without a before snapshot.
        }

        try {
            const after = await client.update(id, patch as Partial<TDraft>);
            await safeAudit(
                String(session.user._id),
                String(session.user._id),
                entityKind,
                id,
                'update',
                { entity: { before, after } },
            );
            safeRevalidate(revalPath);
            return { id, message: 'Updated successfully.' };
        } catch (e) {
            return describeError(e);
        }
    }

    async function deleteEntity(id: string): Promise<CrmActionResult> {
        if (!id) return { error: 'Missing id' };

        const session = await getSession();
        if (!session?.user?._id) {
            return { error: 'Unauthorized' };
        }
        const guard = await requirePermission(permission, 'delete');
        if (!guard.ok) {
            return { error: guard.error };
        }

        try {
            const { deleted } = await client.delete(id);
            if (!deleted) {
                return { error: 'Entity not found.' };
            }
            await safeAudit(
                String(session.user._id),
                String(session.user._id),
                entityKind,
                id,
                'delete',
            );
            safeRevalidate(revalPath);
            return { id, message: 'Deleted successfully.' };
        } catch (e) {
            return describeError(e);
        }
    }

    async function getEntityById(id: string): Promise<TEntity | null> {
        const session = await getSession();
        if (!session?.user?._id) return null;
        const guard = await requirePermission(permission, 'view');
        if (!guard.ok) return null;
        try {
            return await client.getById(id);
        } catch (e) {
            console.error('[makeCrmActions] getById failed:', e);
            return null;
        }
    }

    async function listEntities(params?: CrmListParams): Promise<CrmListResult<TEntity>> {
        const empty: CrmListResult<TEntity> = {
            items: [],
            page: 0,
            limit: params?.limit ?? 20,
            total: 0,
            hasMore: false,
        };
        const session = await getSession();
        if (!session?.user?._id) return empty;
        const guard = await requirePermission(permission, 'view');
        if (!guard.ok) return empty;
        try {
            return await client.list(params);
        } catch (e) {
            console.error('[makeCrmActions] list failed:', e);
            return empty;
        }
    }

    return { saveEntity, updateEntity, deleteEntity, getEntityById, listEntities };
}
