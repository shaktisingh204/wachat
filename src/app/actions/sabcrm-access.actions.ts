'use server';

/**
 * SabCRM — permission-ENFORCEMENT (access-control) server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/access-enforcement.server`. The
 * `gate` / `fail` helpers mirror `sabcrm-scoring.actions.ts` verbatim (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * SECURITY: the per-project flag this toggles is DEFAULT-OFF and, while off, the
 * native read path behaves EXACTLY as today. Turning it on requires a security
 * review on a running app — see the settings page warning and the reviewer
 * checklist. The dry-run preview is read-only and never mutates the flag.
 *
 *   getAccessFlagTw   — `view`  (read the current flag + a dry-run preview)
 *   setAccessFlagTw   — `edit`  (toggle the flag; default off)
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer, getEffectivePermissionsForProject } from '@/lib/rbac-server';
import { isElevatedRole, type PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  getEnforcementFlag,
  setEnforcementFlag,
  dryRunForViewer,
  type AccessFlagDoc,
  type DryRunResult,
} from '@/lib/sabcrm/access-enforcement.server';
import { listObjects } from '@/lib/sabcrm/objects.server';

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

/** Resolve whether the acting user is elevated (owner/admin) on the project. */
async function isElevatedFor(projectId: string): Promise<boolean> {
  try {
    const eff = await getEffectivePermissionsForProject(projectId);
    if (!eff) return false;
    return eff.isOwner || isElevatedRole(eff.role);
  } catch {
    return false;
  }
}

/** The shape returned to the settings page. */
export interface AccessFlagView {
  flag: AccessFlagDoc;
  /** A read-only simulation of what the current user would lose if enabled. */
  dryRun: DryRunResult;
}

/**
 * Read the current enforcement flag PLUS a dry-run preview of what the calling
 * user would lose access to if it were turned on. Gated on `view`. Read-only —
 * never mutates the flag.
 */
export async function getAccessFlagTw(
  projectId?: string,
): Promise<ActionResult<AccessFlagView>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const flag = await getEnforcementFlag(g.ctx.projectId);
    const elevated = await isElevatedFor(g.ctx.projectId);
    const objects = await listObjects(g.ctx.projectId);
    const objectSlugs = objects.map((o) => o.slug).filter(Boolean);
    const dryRun = await dryRunForViewer({
      projectId: g.ctx.projectId,
      viewerUserId: g.ctx.userId,
      objectSlugs,
      elevated,
    });
    return { ok: true, data: { flag, dryRun } };
  } catch (e) {
    return fail(e, 'Failed to load access-control settings.');
  }
}

/**
 * Toggle the per-project enforcement flag. Gated on `edit` (config change, same
 * tier as scoring rule saves). Default is off; this is the ONLY path that can
 * set it on, and the flag must be flipped on ONLY after a security review on a
 * running app (the UI warns about this, and the native read path must AND-in
 * `accessibleFilterFor` for the gate to bite — see the integration snippet).
 */
export async function setAccessFlagTw(
  enabled: boolean,
  projectId?: string,
): Promise<ActionResult<AccessFlagDoc>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await setEnforcementFlag(
      g.ctx.projectId,
      enabled === true,
      g.ctx.userId,
    );
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to update access-control settings.');
  }
}
