'use server';

/**
 * SabCRM — bulk record actions (Twenty UI slice).
 *
 * Gated wrappers over the Rust records engine's bulk endpoints
 * ({@link sabcrmRecordsApi.bulkDelete} / {@link sabcrmRecordsApi.bulkUpdate}).
 * These power multi-select toolbar actions (delete selected / edit selected)
 * on the Twenty-faithful index pages under `/sabcrm/[objectSlug]`.
 *
 * Each action runs the SAME pipeline as `sabcrm-twenty.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *      (defense-in-depth against the fail-open RBAC resolver)
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully and
 * never crashes.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmBulkDeleteResult,
  SabcrmBulkUpdateResult,
} from './sabcrm-bulk.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the Twenty UI re-fetches. */
const TW_BASE_PATH = '/sabcrm';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-twenty.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user
  // (the shared RBAC resolver fails open for non-members; deny instead).
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Bulk actions — via the Rust engine
// ---------------------------------------------------------------------------

/**
 * Bulk-deletes the given records of an object (gate: `delete`). Invalid ids
 * are skipped engine-side; returns the count actually deleted.
 */
export async function bulkDeleteRecordsTw(
  object: string,
  ids: string[],
  projectId?: string,
): Promise<ActionResult<SabcrmBulkDeleteResult>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: 'At least one record id is required.' };
  }

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.bulkDelete(object, g.ctx.projectId, ids);
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: { ok: res.ok, deleted: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete records.');
  }
}

/**
 * Bulk-updates the given records of an object by `$set`ting each `data.<k>`
 * (gate: `edit`). Invalid ids are skipped engine-side; returns the count
 * actually modified.
 */
export async function bulkUpdateRecordsTw(
  object: string,
  ids: string[],
  data: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<SabcrmBulkUpdateResult>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: 'At least one record id is required.' };
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'A data patch is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.bulkUpdate(
      object,
      g.ctx.projectId,
      ids,
      data,
    );
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: { ok: res.ok, updated: res.updated } };
  } catch (e) {
    return fail(e, 'Failed to update records.');
  }
}
