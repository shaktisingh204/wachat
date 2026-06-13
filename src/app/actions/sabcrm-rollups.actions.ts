'use server';

/**
 * SabCRM — rollup fields server actions. Gated wrappers over
 * `@/lib/sabcrm/rollup.server`; save provisions the parent NUMBER field and
 * recomputes existing parents. Gate/fail copied from sabcrm-scoring.actions.ts.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  listRollups,
  upsertRollup,
  deleteRollup,
  recomputeRollupsForObject,
  type RollupField,
  type RollupFieldInput,
} from '@/lib/sabcrm/rollup.server';
import { addFieldTw } from './sabcrm-objects.actions';

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

export async function listRollupsTw(
  projectId?: string,
): Promise<ActionResult<RollupField[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listRollups(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load rollups.');
  }
}

async function ensureRollupField(r: RollupField, projectId: string): Promise<void> {
  const def: FieldMetadata = {
    key: r.fieldKey,
    label: r.name || r.fieldKey,
    type: 'NUMBER',
    icon: 'Sigma',
    inTable: true,
    description: `Rollup: ${r.op} of ${r.childObject}`,
  };
  await addFieldTw(r.objectSlug, def, projectId).catch(() => undefined);
}

export async function saveRollupTw(
  input: RollupFieldInput,
  projectId?: string,
): Promise<ActionResult<RollupField>> {
  if (!input?.objectSlug) return { ok: false, error: 'A parent object is required.' };
  if (!input?.fieldKey?.trim()) return { ok: false, error: 'A field key is required.' };
  if (!input?.childObject) return { ok: false, error: 'A child object is required.' };
  if (!input?.childRelationField) return { ok: false, error: 'A child relation field is required.' };
  if (input.op !== 'count' && !input.childTargetField) {
    return { ok: false, error: 'A child field to aggregate is required for this operation.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertRollup(g.ctx.projectId, input);
    if (saved.enabled) {
      await ensureRollupField(saved, g.ctx.projectId);
      await recomputeRollupsForObject(g.ctx.projectId, saved.objectSlug).catch(() => undefined);
    }
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save rollup.');
  }
}

export async function deleteRollupTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A rollup id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteRollup(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Rollup not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete rollup.');
  }
}

export async function recomputeRollupsTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ scanned: number; updated: number }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await recomputeRollupsForObject(g.ctx.projectId, objectSlug) };
  } catch (e) {
    return fail(e, 'Failed to recompute rollups.');
  }
}
