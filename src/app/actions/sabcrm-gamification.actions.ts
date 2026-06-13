'use server';

/**
 * SabCRM — sales gamification server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/gamification.server`. The `gate` /
 * `fail` helpers mirror `sabcrm-scoring.actions.ts` verbatim (session → project
 * membership → RBAC `canServer('sabcrm', …)` → plan), including the cross-tenant
 * defense against a client-supplied `projectId`.
 *
 * Reads (leaderboard, scorecard, contest list) are gated `view`; contest
 * mutations are gated `edit` (there is no `manage` action — config gates `edit`,
 * per the RBAC vocabulary).
 *
 * NO LLM CALL — gamification is pure Mongo aggregation + the in-house ranking
 * math, so there is no `canUse('ai_requests')` / `recordUsage` metering here.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  buildLeaderboard,
  buildScorecard,
  listContests,
  upsertContest,
  deleteContest,
  type LeaderboardResult,
  type LeaderboardOptions,
  type Scorecard,
  type Contest,
  type ContestInput,
  type GamificationPeriod,
} from '@/lib/sabcrm/gamification.server';

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

/* -------------------------------------------------------------------------- */
/* Reads (view)                                                                */
/* -------------------------------------------------------------------------- */

/** Ranked leaderboard for the active project + period. Gated on `view`. */
export async function getLeaderboardTw(
  opts?: LeaderboardOptions,
  projectId?: string,
): Promise<ActionResult<LeaderboardResult>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await buildLeaderboard(g.ctx.projectId, opts ?? {}) };
  } catch (e) {
    return fail(e, 'Failed to load leaderboard.');
  }
}

/**
 * The signed-in rep's own scorecard (rank, attainment, streak, badges). Gated
 * on `view`. Always scopes to the session user — a member cannot read another
 * rep's private scorecard through this action.
 */
export async function getMyScorecardTw(
  period?: GamificationPeriod,
  projectId?: string,
): Promise<ActionResult<Scorecard>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await buildScorecard(g.ctx.projectId, g.ctx.userId, period ?? 'month'),
    };
  } catch (e) {
    return fail(e, 'Failed to load your scorecard.');
  }
}

/** List contests in the active project. Gated on `view`. */
export async function listContestsTw(
  activeOnly?: boolean,
  projectId?: string,
): Promise<ActionResult<Contest[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await listContests(g.ctx.projectId, { activeOnly: activeOnly === true }),
    };
  } catch (e) {
    return fail(e, 'Failed to load contests.');
  }
}

/* -------------------------------------------------------------------------- */
/* Contest CRUD (edit)                                                         */
/* -------------------------------------------------------------------------- */

/** Create or update a contest. Gated on `edit`. */
export async function saveContestTw(
  input: ContestInput,
  projectId?: string,
): Promise<ActionResult<Contest>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A contest name is required.' };
  if (!input.startsAt || !input.endsAt) {
    return { ok: false, error: 'Start and end dates are required.' };
  }
  if (input.endsAt < input.startsAt) {
    return { ok: false, error: 'End date must be on or after the start date.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await upsertContest(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to save contest.');
  }
}

/** Delete a contest by id. Gated on `edit`. */
export async function deleteContestTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A contest id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteContest(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Contest not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete contest.');
  }
}
