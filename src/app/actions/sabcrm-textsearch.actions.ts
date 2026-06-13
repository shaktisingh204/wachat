'use server';

/**
 * SabCRM — indexed full-text search server action.
 *
 * A gated wrapper over `@/lib/sabcrm/text-search.server.searchRecordsText` — a
 * MongoDB `$text` query over `sabcrm_records` ranked by text score. This is the
 * INDEXED counterpart to `sabcrm-search.actions.globalSearchTw` (which runs the
 * Rust engine's substring/cosine scan); the command-menu / global search can
 * call this first and fall back to `globalSearchTw` when it returns nothing.
 *
 * The `gate` / `fail` helpers are copied verbatim from
 * `sabcrm-scoring.actions.ts` (session → project membership → RBAC
 * `canServer('sabcrm', …)` → plan), including the cross-tenant defense against a
 * client-supplied `projectId`. Search is a read, so it gates `'view'` and the
 * search itself is owner-scoped by the session `userId` (mirroring the native
 * records runtime).
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  searchRecordsText,
  type TextSearchHit,
} from '@/lib/sabcrm/text-search.server';

const MODULE_KEY = 'sabcrm';

/** Hard cap on hits requested (matches the server-side cap). */
const SEARCH_LIMIT = 50;

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions.ts). */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  if (!(await canServer(MODULE_KEY, action, requested))) {
    return { ok: false, error: 'Permission denied.' };
  }
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/**
 * Indexed full-text search across the active project's records. Returns ranked
 * hits (`{ object, id, label, snippet?, score }`). An empty / whitespace `term`
 * short-circuits to an empty list (no DB call). Gated on `view`; owner-scoped by
 * the session `userId`.
 */
export async function searchTextTw(
  term: string,
  projectId?: string,
): Promise<ActionResult<TextSearchHit[]>> {
  const needle = (term ?? '').trim();
  if (!needle) return { ok: true, data: [] };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const hits = await searchRecordsText(g.ctx.projectId, needle, {
      limit: SEARCH_LIMIT,
      userId: g.ctx.userId,
    });
    return { ok: true, data: hits };
  } catch (e) {
    return fail(e, 'Failed to run search.');
  }
}
