'use server';

/**
 * SabCRM — data-quality / health server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/data-quality-score.server`. The
 * `gate` / `fail` helpers are copied verbatim from `sabcrm-scoring.actions.ts`
 * (session → project membership → RBAC `canServer('sabcrm', …)` → plan),
 * including the cross-tenant defense against a client-supplied `projectId`.
 *
 * These are READ actions — they grade existing records and roll the breakdown
 * into a health summary — so they gate `view` and do NOT meter (no AI / no
 * billable work). They DO best-effort persist each record's `data.__dq` meta
 * via the envelope (a scalar `$set` both stores serve, no `updatedAt` bump), so
 * opening the dashboard also refreshes the stored per-record breakdown.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  scanObjectHealth,
  scanProjectHealth,
  type ObjectHealthSummary,
} from '@/lib/sabcrm/data-quality-score.server';

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
 * Health summary for ONE object: average completeness / validity / freshness /
 * overall plus the worst-scoring records. Gated on `view`. Best-effort writes
 * each scanned record's `data.__dq` meta.
 */
export async function getDataHealthTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<ObjectHealthSummary>> {
  if (!object) return { ok: false, error: 'An object is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await scanObjectHealth(g.ctx.projectId, object) };
  } catch (e) {
    return fail(e, 'Failed to compute data health.');
  }
}

/**
 * Health summaries for EVERY non-system object in the project (the dashboard's
 * per-object cards). Gated on `view`. Best-effort writes each scanned record's
 * `data.__dq` meta.
 */
export async function getProjectDataHealthTw(
  projectId?: string,
): Promise<ActionResult<ObjectHealthSummary[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await scanProjectHealth(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to compute data health.');
  }
}
