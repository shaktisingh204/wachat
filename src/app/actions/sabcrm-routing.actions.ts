'use server';

/**
 * SabCRM — assignment-routing server actions.
 *
 * Routing rules (crate `sabcrm-routing`, collection `sabcrm_routing_rules`)
 * assign an owner to records as they arrive: ordered, condition-gated rules
 * (`round_robin` / `least_assigned` / `fixed` strategies) whose first active
 * match writes the picked member onto the record's `data.<assignField>`
 * (default `owner`).
 *
 * Automatic evaluation is wired at:
 *  - `record.created` — `src/lib/sabcrm/runtime.ts` (BEFORE workflows fire,
 *    so the assignment is visible to workflow conditions);
 *  - `form.submission` — `convertSabcrmSubmissionToRecord` in
 *    `sabcrm-forms.actions.ts` (after the converted record is created).
 *
 * {@link evaluateSabcrmRouting} is the manual "route this record now" path.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-stage-gates.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed result
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown
 * value is normalised into an `{ ok: false, error }` result.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRoutingApi } from '@/lib/rust-client/sabcrm-routing';
import type {
  SabcrmRoutingEvaluateInput,
  SabcrmRoutingEvaluateResult,
  SabcrmRoutingListParams,
  SabcrmRustRoutingRule,
} from '@/lib/rust-client/sabcrm-routing';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmRoutingRuleBuilderInput,
  SabcrmRoutingRulePatchInput,
} from './sabcrm-routing.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the SabCRM UI re-fetches. */
const TW_BASE_PATH = '/sabcrm';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate (session → project → RBAC → plan) — mirrors sabcrm-stage-gates.actions
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-stage-gates.actions.ts` verbatim, including the
 * cross-tenant defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
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

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Rule CRUD
// ---------------------------------------------------------------------------

/**
 * Lists the project's routing rules in priority order (`position` asc),
 * optionally narrowed by object slug / trigger / active.
 */
export async function listSabcrmRoutingRules(
  params?: SabcrmRoutingListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRoutingRule[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRoutingApi.list(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list routing rules.');
  }
}

/** Fetches one routing rule. */
export async function getSabcrmRoutingRule(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRoutingRule>> {
  if (!id) return { ok: false, error: 'Rule id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRoutingApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load the routing rule.');
  }
}

/**
 * Creates a routing rule. Defaults applied server-side: trigger
 * `record.created`, strategy `round_robin`, assignField `owner`, active
 * `true`, position `0`. `assignees` must be non-empty.
 */
export async function createSabcrmRoutingRule(
  input: SabcrmRoutingRuleBuilderInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRoutingRule>> {
  if (!input?.name?.trim()) return { ok: false, error: 'Name is required.' };
  if (!input?.objectSlug?.trim()) {
    return { ok: false, error: 'objectSlug is required.' };
  }
  if (!input?.assignees?.length) {
    return { ok: false, error: 'At least one assignee is required.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRoutingApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      objectSlug: input.objectSlug.trim(),
      trigger: input.trigger,
      conditions: input.conditions,
      strategy: input.strategy,
      assignees: input.assignees,
      assignField: input.assignField,
      active: input.active,
      position: input.position,
    });
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create the routing rule.');
  }
}

/**
 * Partially updates a routing rule (rename, enable/disable, reorder, swap
 * roster / strategy / conditions). The round-robin cursor
 * (`lastAssignedIndex`) is server-managed and not writable here.
 */
export async function updateSabcrmRoutingRule(
  id: string,
  patch: SabcrmRoutingRulePatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRoutingRule>> {
  if (!id) return { ok: false, error: 'Rule id is required.' };
  if (!patch || Object.keys(patch).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRoutingApi.update(g.ctx.projectId, id, patch);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the routing rule.');
  }
}

/** Deletes a routing rule. */
export async function deleteSabcrmRoutingRule(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Rule id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRoutingApi.remove(g.ctx.projectId, id);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to delete the routing rule.');
  }
}

// ---------------------------------------------------------------------------
// Manual evaluation
// ---------------------------------------------------------------------------

/**
 * Manually routes one record now: applies the FIRST matching active rule for
 * `(objectSlug, trigger)` — the assignee is written onto the record's
 * `data.<assignField>` server-side (atomic round-robin rotation). Returns
 * `{ matched: false }` when no rule accepts the record (it is left
 * untouched).
 */
export async function evaluateSabcrmRouting(
  input: SabcrmRoutingEvaluateInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRoutingEvaluateResult>> {
  if (!input?.objectSlug) return { ok: false, error: 'objectSlug is required.' };
  if (!input?.recordId) return { ok: false, error: 'recordId is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRoutingApi.evaluate(g.ctx.projectId, input);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to evaluate routing.');
  }
}
