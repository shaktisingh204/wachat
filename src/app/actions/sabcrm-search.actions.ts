'use server';

/**
 * SabCRM — global (cross-object) search server action.
 *
 * A thin, gated wrapper over the Rust records engine's cross-object search
 * surface ({@link sabcrmRecordsApi.searchAll} in
 * `@/lib/rust-client/sabcrm-records`). Powers the command-menu / global search
 * box: one query fans out over EVERY object in the active project and returns
 * ranked record hits ({@link GlobalSearchHit}).
 *
 * Follows the SAME pipeline as the sibling `sabcrm-views.actions.ts` /
 * `sabcrm-twenty.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', 'view', projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { GlobalSearchHit } from './sabcrm-search.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Hard cap on hits requested from the engine (matches the server-side cap). */
const SEARCH_LIMIT = 50;

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate (copied from sabcrm-views.actions.ts)
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
 * helper in `sabcrm-views.actions.ts` verbatim, including the cross-tenant
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
// Global search — via the Rust engine
// ---------------------------------------------------------------------------

/**
 * Cross-object global search over the active project. Returns ranked record
 * hits (`{ object, id, label, snippet? }`). An empty / whitespace `q` short
 * circuits to an empty list (no engine call).
 */
export async function globalSearchTw(
  q: string,
  projectId?: string,
): Promise<ActionResult<GlobalSearchHit[]>> {
  const needle = (q ?? '').trim();
  if (!needle) return { ok: true, data: [] };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.searchAll(
      g.ctx.projectId,
      needle,
      SEARCH_LIMIT,
    );
    return { ok: true, data: res.hits };
  } catch (e) {
    return fail(e, 'Failed to run search.');
  }
}
