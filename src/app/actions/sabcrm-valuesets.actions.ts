'use server';

/**
 * SabCRM — global value-sets server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/value-sets.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defence against a client-supplied `projectId`.
 *
 * Value-sets are reusable picklists: a SELECT/MULTI_SELECT field opts in by
 * storing the set id under its `settings.valueSetId`, and the record form /
 * option resolver expands the reference via
 * `resolveOptionsForFieldMetadata`. Reads gate `view`; create/config/delete and
 * value add/deprecate gate `edit` (there is no `manage` action).
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listValueSets,
  getValueSet,
  upsertValueSet,
  deleteValueSet,
  addValue,
  deprecateValue,
  type GlobalValueSet,
  type ValueSetInput,
} from '@/lib/sabcrm/value-sets.server';

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

/** List every global value-set in the active project. Gated on `view`. */
export async function listValueSetsTw(
  projectId?: string,
): Promise<ActionResult<GlobalValueSet[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listValueSets(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load value sets.');
  }
}

/** Fetch one value-set by id. Gated on `view`. */
export async function getValueSetTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<GlobalValueSet>> {
  if (!id) return { ok: false, error: 'A value set id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const set = await getValueSet(g.ctx.projectId, id);
    if (!set) return { ok: false, error: 'Value set not found.' };
    return { ok: true, data: set };
  } catch (e) {
    return fail(e, 'Failed to load value set.');
  }
}

/** Create or update a value-set (name + its values). Gated on `edit`. */
export async function saveValueSetTw(
  input: ValueSetInput,
  projectId?: string,
): Promise<ActionResult<GlobalValueSet>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await upsertValueSet(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to save value set.');
  }
}

/** Delete a value-set by id. Gated on `edit`. */
export async function deleteValueSetTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A value set id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteValueSet(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Value set not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete value set.');
  }
}

/** Add (or re-activate) a value on a set. Gated on `edit`. */
export async function addValueTw(
  id: string,
  value: { value: string; label?: string; color?: string },
  projectId?: string,
): Promise<ActionResult<GlobalValueSet>> {
  if (!id) return { ok: false, error: 'A value set id is required.' };
  if (!value?.value?.trim()) return { ok: false, error: 'A value is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const set = await addValue(g.ctx.projectId, id, value);
    if (!set) return { ok: false, error: 'Value set not found.' };
    return { ok: true, data: set };
  } catch (e) {
    return fail(e, 'Failed to add value.');
  }
}

/** Deprecate (deactivate) a value on a set. Gated on `edit`. */
export async function deprecateValueTw(
  id: string,
  value: string,
  projectId?: string,
): Promise<ActionResult<GlobalValueSet>> {
  if (!id) return { ok: false, error: 'A value set id is required.' };
  if (!value?.trim()) return { ok: false, error: 'A value is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const set = await deprecateValue(g.ctx.projectId, id, value);
    if (!set) return { ok: false, error: 'Value set not found.' };
    return { ok: true, data: set };
  } catch (e) {
    return fail(e, 'Failed to deprecate value.');
  }
}
