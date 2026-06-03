'use server';

/**
 * SabCRM — saved-views server actions.
 *
 * Thin, gated wrappers over the Rust views engine
 * ({@link sabcrmViewsApi} in `@/lib/rust-client/sabcrm-views`). These power the
 * per-object view switcher (table / board presentations: filters, sort, fields,
 * groupBy, default) on the Twenty-faithful index pages under
 * `/sabcrm/[objectSlug]`, plus the server-side "run a saved view" path.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-twenty.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmViewsApi } from '@/lib/rust-client/sabcrm-views';
import type { SabcrmRustView } from '@/lib/rust-client/sabcrm-views';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreateViewTwInput,
  UpdateViewTwPatch,
  SabcrmViewRunOpts,
  SabcrmViewRunPage,
} from './sabcrm-views.actions.types';

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

  // 2. active project — only accept a projectId that belongs to THIS user.
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
// Views CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the saved views for one object through the Rust engine. */
export async function listViewsTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustView[]>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmViewsApi.list(g.ctx.projectId, object);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list views.');
  }
}

/** Creates a saved view for an object. */
export async function createViewTw(
  input: CreateViewTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustView>> {
  if (!input?.object) return { ok: false, error: 'Object is required.' };
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const view = await sabcrmViewsApi.create(g.ctx.projectId, input);
    revalidatePath(`${TW_BASE_PATH}/${input.object}`);
    return { ok: true, data: view };
  } catch (e) {
    return fail(e, 'Failed to create view.');
  }
}

/** Partial-updates a saved view (name, filters, sort, fields, …). */
export async function updateViewTw(
  id: string,
  patch: UpdateViewTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustView>> {
  if (!id) return { ok: false, error: 'View id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const view = await sabcrmViewsApi.update(g.ctx.projectId, id, patch);
    if (typeof view.object === 'string' && view.object) {
      revalidatePath(`${TW_BASE_PATH}/${view.object}`);
    }
    return { ok: true, data: view };
  } catch (e) {
    return fail(e, 'Failed to update view.');
  }
}

/** Deletes a saved view by id. */
export async function deleteViewTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'View id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmViewsApi.remove(g.ctx.projectId, id);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete view.');
  }
}

/** Makes a saved view the default for its object. */
export async function setDefaultViewTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustView>> {
  if (!id) return { ok: false, error: 'View id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const view = await sabcrmViewsApi.setDefault(g.ctx.projectId, id);
    if (typeof view.object === 'string' && view.object) {
      revalidatePath(`${TW_BASE_PATH}/${view.object}`);
    }
    return { ok: true, data: view };
  } catch (e) {
    return fail(e, 'Failed to set default view.');
  }
}

/**
 * Runs a saved view: applies its persisted filters/sort to the records
 * collection server-side and returns a paginated page of records.
 */
export async function runViewTw(
  id: string,
  opts?: SabcrmViewRunOpts,
  projectId?: string,
): Promise<ActionResult<SabcrmViewRunPage>> {
  if (!id) return { ok: false, error: 'View id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmViewsApi.run(g.ctx.projectId, id, opts);
    return { ok: true, data: { records: res.records, total: res.total } };
  } catch (e) {
    return fail(e, 'Failed to run view.');
  }
}
