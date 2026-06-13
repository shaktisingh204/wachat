'use server';

/**
 * SabCRM — criteria / ownership SHARING rule server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/sharing-rules.server`. The `gate` /
 * `fail` helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session
 * → project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * Reads are gated on `view`; every write/config (rule CRUD + the enforcement
 * flag) is gated on `edit` — there is no `manage` action in this RBAC model.
 *
 * SECURITY: sharing rules only ever WIDEN read access, and the read-path that
 * applies them is DEFAULT-OFF behind a per-project enforcement flag. Authoring
 * rules has no effect on live reads until an admin explicitly enables
 * enforcement via `setSharingEnforcementTw` — which should only be done on a
 * running app with a security review, because it widens record visibility.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listSharingRules,
  upsertSharingRule,
  deleteSharingRule,
  isSharingEnforcementEnabled,
  setSharingEnforcementEnabled,
  type SharingRule,
  type SharingRuleInput,
} from '@/lib/sabcrm/sharing-rules.server';

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

/** List sharing rules in the active project (optionally one object). Gated `view`. */
export async function listSharingRulesTw(
  projectId?: string,
  object?: string,
): Promise<ActionResult<SharingRule[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listSharingRules(g.ctx.projectId, object) };
  } catch (e) {
    return fail(e, 'Failed to load sharing rules.');
  }
}

/** Whether sharing enforcement is enabled for the active project. Gated `view`. */
export async function getSharingEnforcementTw(
  projectId?: string,
): Promise<ActionResult<{ enabled: boolean }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: { enabled: await isSharingEnforcementEnabled(g.ctx.projectId) },
    };
  } catch (e) {
    return fail(e, 'Failed to load enforcement state.');
  }
}

/** Create or update a sharing rule. Gated on `edit`. */
export async function saveSharingRuleTw(
  input: SharingRuleInput,
  projectId?: string,
): Promise<ActionResult<SharingRule>> {
  if (!input?.object) return { ok: false, error: 'An object is required.' };
  if (input.type !== 'owner' && input.type !== 'criteria') {
    return { ok: false, error: 'A rule type (owner or criteria) is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await upsertSharingRule(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to save sharing rule.');
  }
}

/** Delete a sharing rule by id. Gated on `edit`. */
export async function deleteSharingRuleTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A rule id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteSharingRule(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Rule not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete sharing rule.');
  }
}

/**
 * Toggle the per-project SHARING enforcement flag. Gated on `edit`.
 *
 * SECURITY: enabling this WIDENS record visibility (the read path begins
 * OR-extending with sharing clauses). It is DEFAULT-OFF and should only be
 * enabled deliberately, on a running app, after a security review of the
 * project's authored rules.
 */
export async function setSharingEnforcementTw(
  enabled: boolean,
  projectId?: string,
): Promise<ActionResult<{ enabled: boolean }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await setSharingEnforcementEnabled(g.ctx.projectId, enabled === true);
    return { ok: true, data: { enabled: enabled === true } };
  } catch (e) {
    return fail(e, 'Failed to update enforcement state.');
  }
}
