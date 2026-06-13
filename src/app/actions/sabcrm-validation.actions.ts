'use server';

/**
 * SabCRM — data-quality server actions (validation rules + fuzzy duplicates).
 *
 * Thin gated wrappers over `@/lib/sabcrm/data-quality.server`. The `gate` /
 * `fail` helpers are copied verbatim from `sabcrm-scoring.actions.ts`
 * (session → project membership → RBAC `canServer('sabcrm', …)` → plan), with
 * the cross-tenant defense against a client-supplied `projectId`.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listValidationRuleSets,
  upsertValidationRuleSet,
  deleteValidationRuleSet,
  findFuzzyDuplicates,
  type ValidationRuleSet,
  type ValidationRuleSetInput,
  type FuzzyDupCluster,
} from '@/lib/sabcrm/data-quality.server';

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

/** List every validation rule set in the active project. Gated on `view`. */
export async function listValidationRulesTw(
  projectId?: string,
): Promise<ActionResult<ValidationRuleSet[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listValidationRuleSets(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load validation rules.');
  }
}

/** Create or update a validation rule set. Gated on `edit`. */
export async function saveValidationRulesTw(
  input: ValidationRuleSetInput,
  projectId?: string,
): Promise<ActionResult<ValidationRuleSet>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await upsertValidationRuleSet(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to save validation rules.');
  }
}

/** Delete a validation rule set by id. Gated on `edit`. */
export async function deleteValidationRulesTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A rule set id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteValidationRuleSet(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Rule set not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete validation rules.');
  }
}

/** On-demand fuzzy duplicate scan for an object/field. Gated on `view`. */
export async function findFuzzyDuplicatesTw(
  objectSlug: string,
  fieldKey: string,
  threshold = 0.85,
  kind?: 'text' | 'email' | 'phone',
  projectId?: string,
): Promise<ActionResult<FuzzyDupCluster[]>> {
  if (!objectSlug || !fieldKey) {
    return { ok: false, error: 'Object and field are required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await findFuzzyDuplicates(
        g.ctx.projectId,
        objectSlug,
        fieldKey,
        threshold,
        kind,
      ),
    };
  } catch (e) {
    return fail(e, 'Failed to scan for duplicates.');
  }
}
