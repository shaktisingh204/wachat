'use server';

/**
 * SabCRM — fractional ranking server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/ranking.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * The kanban board calls {@link moveRecordTw} on every drop to persist the
 * manual card order (a single `data.__rank` write, no `updatedAt` bump), and
 * sorts its columns by `data.__rank` ascending. There is no settings page and
 * no field provisioning — the rank is a reserved system meta scalar
 * (`data.__rank`), exactly like `data.__ai` / `data.__score`.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  moveRecord,
  ensureRanks,
  type MoveRecordResult,
  type EnsureRanksResult,
} from '@/lib/sabcrm/ranking.server';

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

/**
 * Persist a manual reorder of `recordId` between the two cards it was dropped
 * between. `beforeId` is the neighbour now ABOVE it, `afterId` the neighbour
 * now BELOW it; either may be null (dropped at the top / bottom of the column).
 * Gated on `edit` — reordering mutates a record's stored sort key.
 */
export async function moveRecordTw(
  object: string,
  recordId: string,
  beforeId: string | null,
  afterId: string | null,
  projectId?: string,
): Promise<ActionResult<MoveRecordResult>> {
  if (!object) return { ok: false, error: 'An object is required.' };
  if (!recordId) return { ok: false, error: 'A record id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const result = await moveRecord(
      g.ctx.projectId,
      object,
      recordId,
      beforeId ?? null,
      afterId ?? null,
    );
    if (!result.moved) {
      return { ok: false, error: result.detail || 'Could not reorder record.' };
    }
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to reorder record.');
  }
}

/**
 * Backfill `data.__rank` for any live records of an object that lack one,
 * without disturbing already-ranked cards. Lets a board lazily ensure every
 * card is rankable before the user starts dragging. Gated on `edit`.
 */
export async function ensureRanksTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<EnsureRanksResult>> {
  if (!object) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await ensureRanks(g.ctx.projectId, object) };
  } catch (e) {
    return fail(e, 'Failed to backfill ranks.');
  }
}
