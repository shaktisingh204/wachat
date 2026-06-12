'use server';

/**
 * SabCRM — polymorphic targets server actions.
 *
 * Thin, gated wrappers over the Rust targets engine
 * ({@link sabcrmTargetsApi} in `@/lib/rust-client/sabcrm-targets`). These
 * power the note / task / activity ↔ record relation pickers on the
 * Twenty-faithful record pages under `/sabcrm/[objectSlug]/[recordId]`:
 * one activity can fan out to many records of any object, and one record
 * collects all the activities pointed at it.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-views.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown
 * value is normalised into `{ ok: false, error }` so the UI degrades
 * gracefully.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmQuotasApi, sabcrmTargetsApi } from '@/lib/rust-client/sabcrm-targets';
import type {
  SabcrmQuotaCreateInput,
  SabcrmQuotaListOpts,
  SabcrmQuotaUpdateInput,
  SabcrmRustQuota,
  SabcrmRustTarget,
} from '@/lib/rust-client/sabcrm-targets';
import type { ActionResult } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Copied from the
 * `gate` helper in `sabcrm-views.actions.ts`, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
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
// Targets — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the records a single note / task / activity is attached to. */
export async function listTargetsForSourceTw(
  sourceObject: string,
  sourceId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTarget[]>> {
  if (!sourceObject) return { ok: false, error: 'sourceObject is required.' };
  if (!sourceId) return { ok: false, error: 'sourceId is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTargetsApi.listForSource(
      g.ctx.projectId,
      sourceObject,
      sourceId,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list targets.');
  }
}

/** Lists the notes / tasks / activities attached to a single record. */
export async function listTargetsForRecordTw(
  targetObject: string,
  targetId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTarget[]>> {
  if (!targetObject) return { ok: false, error: 'targetObject is required.' };
  if (!targetId) return { ok: false, error: 'targetId is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTargetsApi.listForRecord(
      g.ctx.projectId,
      targetObject,
      targetId,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list targets.');
  }
}

/** Links a source activity to a record (idempotent). */
export async function linkTargetTw(
  sourceObject: string,
  sourceId: string,
  targetObject: string,
  targetId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTarget>> {
  if (!sourceObject) return { ok: false, error: 'sourceObject is required.' };
  if (!sourceId) return { ok: false, error: 'sourceId is required.' };
  if (!targetObject) return { ok: false, error: 'targetObject is required.' };
  if (!targetId) return { ok: false, error: 'targetId is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTargetsApi.link(
      g.ctx.projectId,
      sourceObject,
      sourceId,
      targetObject,
      targetId,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to link target.');
  }
}

/** Unlinks a source activity from a record (idempotent). */
export async function unlinkTargetTw(
  sourceObject: string,
  sourceId: string,
  targetObject: string,
  targetId: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!sourceObject) return { ok: false, error: 'sourceObject is required.' };
  if (!sourceId) return { ok: false, error: 'sourceId is required.' };
  if (!targetObject) return { ok: false, error: 'targetObject is required.' };
  if (!targetId) return { ok: false, error: 'targetId is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmTargetsApi.unlink(
      g.ctx.projectId,
      sourceObject,
      sourceId,
      targetObject,
      targetId,
    );
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to unlink target.');
  }
}

// ---------------------------------------------------------------------------
// Sales quotas (goals) — via the Rust engine's `/quotas` sub-resource
//
// Per-project sales targets powering the `/sabcrm/forecast` weighted-forecast
// + attainment UI. Each quota is
// `{ name, period: month|quarter, periodStart, metric: revenue|count,
//    amount, memberId? (absent = team), pipelineId? (absent = all) }`.
// Same gate pipeline as the junction actions above.
// ---------------------------------------------------------------------------

/** Lists the active project's sales quotas, newest `periodStart` first. */
export async function listSalesTargetsTw(
  opts?: SabcrmQuotaListOpts,
  projectId?: string,
): Promise<ActionResult<SabcrmRustQuota[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmQuotasApi.list(g.ctx.projectId, opts);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list sales targets.');
  }
}

/** Creates a sales quota for the active project. */
export async function createSalesTargetTw(
  input: SabcrmQuotaCreateInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustQuota>> {
  if (!input?.name?.trim()) return { ok: false, error: 'Name is required.' };
  if (input.period !== 'month' && input.period !== 'quarter') {
    return { ok: false, error: 'Period must be "month" or "quarter".' };
  }
  if (!input.periodStart) return { ok: false, error: 'Period start is required.' };
  if (input.metric !== 'revenue' && input.metric !== 'count') {
    return { ok: false, error: 'Metric must be "revenue" or "count".' };
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmQuotasApi.create(g.ctx.projectId, input);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create sales target.');
  }
}

/**
 * Partially updates a sales quota. Only present keys are written; send an
 * explicit empty string for `memberId` / `pipelineId` to clear the scope.
 */
export async function updateSalesTargetTw(
  id: string,
  input: SabcrmQuotaUpdateInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustQuota>> {
  if (!id) return { ok: false, error: 'Quota id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmQuotasApi.update(g.ctx.projectId, id, input);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update sales target.');
  }
}

/** Deletes a sales quota (idempotent). */
export async function deleteSalesTargetTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Quota id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmQuotasApi.remove(g.ctx.projectId, id);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete sales target.');
  }
}
