'use server';

/**
 * SabCRM — Next-Best-Action (NBA) work-queue server actions.
 *
 * Thin gated wrapper over `@/lib/sabcrm/nba.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * The NBA queue is a DERIVED, READ-ONLY surface (recomputed per request, like
 * the Forecast page), so the only action here is a `view`-gated read. By default
 * the queue is scoped to the signed-in member's tasks / cadences (a rep's "what
 * should I do now" list) while funnel candidates span the project book; pass
 * `projectWide` for the manager view across the whole team.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import { buildNbaQueue, type NbaQueueResult } from '@/lib/sabcrm/nba.server';

const MODULE_KEY = 'sabcrm';

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

/** Options accepted by the queue read (kept serialisable for the client). */
export interface GetNbaQueueOptions {
  /** Cap on the returned queue length (default 50, max 200). */
  limit?: number;
  /**
   * When true, build the team-wide queue (every member's tasks / cadences).
   * When false/omitted, scope tasks + cadences to the signed-in member.
   */
  projectWide?: boolean;
}

/**
 * Build the ranked Next-Best-Action queue for the active project. Gated on
 * `view`. Best-effort under the hood — a downed engine degrades the queue, the
 * action still resolves `{ ok: true, data }`.
 */
export async function getNbaQueueTw(
  projectId?: string,
  options?: GetNbaQueueOptions,
): Promise<ActionResult<NbaQueueResult>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await buildNbaQueue(g.ctx.projectId, g.ctx.userId, {
      limit: options?.limit,
      forUserId: options?.projectWide ? undefined : g.ctx.userId,
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to build the next-best-action queue.');
  }
}
