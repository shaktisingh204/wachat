'use server';

/**
 * SabCRM runtime actions — explicit, gated entry points for firing the stored
 * engines on demand (as opposed to the implicit, inline firing the record
 * mutation actions in `./sabcrm-twenty.actions.ts` perform).
 *
 * Today this exposes a single "run a workflow now" action, used by the
 * workflows UI's manual-run button. The heavy lifting lives in the best-effort
 * `src/lib/sabcrm/runtime.ts` helper, which never throws — so a downed engine
 * surfaces as `{ ran: false }` rather than an error.
 *
 * The gate pipeline (session → project membership → RBAC → plan) mirrors the
 * `gate` helper in `./sabcrm-twenty.actions.ts` verbatim, including the
 * cross-tenant defense against a client-supplied `projectId`.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { executeWorkflowById } from '@/lib/sabcrm/runtime';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { RunWorkflowNowResult } from './sabcrm-runtime.actions.types';

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `./sabcrm-twenty.actions.ts`, including the cross-tenant defense
 * against a client-supplied `explicitProjectId`.
 */
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
  const projectId = requested;

  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/**
 * Manually run a single workflow by id — fires its steps once, independent of
 * any record event. Gated on `edit`. Best-effort: a downed engine returns
 * `{ ran: false }` instead of erroring.
 */
export async function runWorkflowNowTw(
  workflowId: string,
  projectId?: string,
): Promise<ActionResult<RunWorkflowNowResult>> {
  if (!workflowId) return { ok: false, error: 'A workflow id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const res = await executeWorkflowById(
    g.ctx.projectId,
    workflowId,
    undefined,
    undefined,
    g.ctx.userId,
  );
  return { ok: true, data: { ran: res.ran, summary: res.summary } };
}
