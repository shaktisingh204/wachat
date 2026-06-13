'use server';

/**
 * SabCRM → SabFlow automation bindings — server actions.
 *
 * Gated wrappers over `@/lib/sabcrm/flow-bindings.server`. The gate/fail
 * helpers are copied from `sabcrm-scoring.actions.ts` (session → project
 * membership → RBAC → plan, with the cross-tenant defense).
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listSabcrmFlowBindings,
  upsertSabcrmFlowBinding,
  deleteSabcrmFlowBinding,
  listSabcrmAutomationFlows,
  type SabcrmFlowBinding,
  type SabcrmFlowBindingInput,
  type SabcrmAutomationFlow,
} from '@/lib/sabcrm/flow-bindings.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}
interface GateContext {
  userId: string;
  projectId: string;
}
type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

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

/** List CRM→flow bindings for the active project. Gated on `view`. */
export async function listSabcrmFlowBindingsTw(
  projectId?: string,
): Promise<ActionResult<SabcrmFlowBinding[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listSabcrmFlowBindings(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load automations.');
  }
}

/** List flows available to bind. Gated on `view`. */
export async function listSabcrmAutomationFlowsTw(
  projectId?: string,
): Promise<ActionResult<SabcrmAutomationFlow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listSabcrmAutomationFlows(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load flows.');
  }
}

/** Create or update a CRM→flow binding. Gated on `edit`. */
export async function saveSabcrmFlowBindingTw(
  input: SabcrmFlowBindingInput,
  projectId?: string,
): Promise<ActionResult<SabcrmFlowBinding>> {
  if (!input?.event) return { ok: false, error: 'An event is required.' };
  if (!input?.flowId) return { ok: false, error: 'A flow is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await upsertSabcrmFlowBinding(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to save automation.');
  }
}

/** Delete a CRM→flow binding by id. Gated on `edit`. */
export async function deleteSabcrmFlowBindingTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A binding id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteSabcrmFlowBinding(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Binding not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete automation.');
  }
}
