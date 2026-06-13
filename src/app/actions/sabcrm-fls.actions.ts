'use server';

/**
 * SabCRM — field-level security (FLS) server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/fls.server`. The `gate` / `fail`
 * helpers mirror `sabcrm-scoring.actions.ts` VERBATIM (session → project
 * membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defence against a client-supplied `projectId`.
 *
 * Gating:
 *   - reads  (`listFlsPoliciesTw`, `getFlsEnforcedTw`) → `view`.
 *   - config (`saveFlsPoliciesTw`, `setFlsEnforcedTw`) → `edit` (RBAC has no
 *     `manage`; config gates `edit`, same as the scoring/objects actions).
 *
 * SECURITY: enabling enforcement (`setFlsEnforcedTw(true)`) is what makes FLS
 * actually hide fields + block writes. It is DEFAULT-OFF per project and should
 * only be turned on after a security review on a running app — flipping it can
 * hide fields and reject writes that previously worked.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listFlsPolicies,
  replaceObjectFlsPolicies,
  isFlsEnforced,
  setFlsEnforced,
  type FlsPolicy,
} from '@/lib/sabcrm/fls.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions). */
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
/* Reads (gated on `view`)                                                      */
/* -------------------------------------------------------------------------- */

/** List FLS policies (optionally for one object). Gated on `view`. */
export async function listFlsPoliciesTw(
  objectSlug?: string,
  projectId?: string,
): Promise<ActionResult<FlsPolicy[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await listFlsPolicies(g.ctx.projectId, objectSlug || undefined),
    };
  } catch (e) {
    return fail(e, 'Failed to load field-security policies.');
  }
}

/** Whether FLS enforcement is enabled for the project. Gated on `view`. */
export async function getFlsEnforcedTw(
  projectId?: string,
): Promise<ActionResult<{ enforced: boolean }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: { enforced: await isFlsEnforced(g.ctx.projectId) } };
  } catch (e) {
    return fail(e, 'Failed to load field-security settings.');
  }
}

/* -------------------------------------------------------------------------- */
/* Config (gated on `edit`)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Replace the entire policy grid for one object. Gated on `edit`. Malformed
 * rows and rows for a different object are dropped server-side; returns the
 * persisted, normalised set.
 */
export async function saveFlsPoliciesTw(
  objectSlug: string,
  policies: FlsPolicy[],
  projectId?: string,
): Promise<ActionResult<FlsPolicy[]>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await replaceObjectFlsPolicies(
        g.ctx.projectId,
        objectSlug,
        Array.isArray(policies) ? policies : [],
      ),
    };
  } catch (e) {
    return fail(e, 'Failed to save field-security policies.');
  }
}

/**
 * Toggle per-project FLS enforcement. Gated on `edit`.
 *
 * Turning this ON is the security-sensitive step — it makes hidden fields
 * actually disappear and readonly writes actually fail. Default is OFF.
 */
export async function setFlsEnforcedTw(
  enforced: boolean,
  projectId?: string,
): Promise<ActionResult<{ enforced: boolean }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await setFlsEnforced(g.ctx.projectId, !!enforced);
    return { ok: true, data: { enforced: !!enforced } };
  } catch (e) {
    return fail(e, 'Failed to update field-security settings.');
  }
}
