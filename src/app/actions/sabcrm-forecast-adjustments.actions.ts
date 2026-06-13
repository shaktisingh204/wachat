'use server';

/**
 * SabCRM — forecast manager-adjustment server actions. Gated wrappers over
 * `@/lib/sabcrm/forecast-adjustments.server`. Gate/fail copied from
 * sabcrm-scoring.actions.ts.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listForecastAdjustments,
  upsertForecastAdjustment,
  deleteForecastAdjustment,
  type ForecastAdjustment,
  type ForecastAdjustmentInput,
} from '@/lib/sabcrm/forecast-adjustments.server';

const MODULE_KEY = 'sabcrm';
interface SessionUser { _id: string; }
interface GateContext { userId: string; projectId: string; }
type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

async function gate(action: PermissionAction, explicitProjectId?: string): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested = explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) return { ok: false, error: 'Permission denied.' };
  if (!(await canServer(MODULE_KEY, action, requested))) return { ok: false, error: 'Permission denied.' };
  if (!sabcrmPlanFeature.defaultEnabled) return { ok: false, error: 'Your plan does not include SabCRM.' };
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

export async function listForecastAdjustmentsTw(
  projectId?: string,
): Promise<ActionResult<ForecastAdjustment[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listForecastAdjustments(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load adjustments.');
  }
}

export async function saveForecastAdjustmentTw(
  input: ForecastAdjustmentInput,
  projectId?: string,
): Promise<ActionResult<ForecastAdjustment>> {
  if (!input?.pipelineId) return { ok: false, error: 'A pipeline is required.' };
  if (!input?.category) return { ok: false, error: 'A category is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await upsertForecastAdjustment(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to save adjustment.');
  }
}

export async function deleteForecastAdjustmentTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'An adjustment id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteForecastAdjustment(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Adjustment not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete adjustment.');
  }
}
