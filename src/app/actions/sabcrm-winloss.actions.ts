'use server';

/**
 * SabCRM — win/loss reason capture server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/win-loss.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * Read actions gate `view`; the config save/delete + field provisioning gate
 * `edit` (config-management — `PermissionAction` has no `manage`, so `edit` is
 * the management ceiling, same as `addFieldTw`).
 *
 * `enableWinLossTw` provisions the `outcome` / `winReason` / `lossReason` SELECT
 * display fields on the target object via the existing `addFieldTw` metadata
 * action (the Rust path — two-store gotcha). Provisioning is best-effort and
 * never fails the call.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  listWinLossConfigs,
  getWinLossConfig,
  upsertWinLossConfig,
  deleteWinLossConfig,
  OUTCOME_FIELD,
  WIN_REASON_FIELD,
  LOSS_REASON_FIELD,
  type WinLossConfig,
  type WinLossConfigInput,
} from '@/lib/sabcrm/win-loss.server';
import { addFieldTw } from './sabcrm-objects.actions';

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

/**
 * A config with neither won nor lost stages classifies every record as `open`,
 * so the feature would silently do nothing. Require at least one stage on either
 * side before persisting.
 */
function hasUsableStages(input: WinLossConfigInput): boolean {
  return (
    (input.wonStages?.length ?? 0) > 0 || (input.lostStages?.length ?? 0) > 0
  );
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

/** List every win/loss config in the active project. Gated on `view`. */
export async function listWinLossConfigsTw(
  projectId?: string,
): Promise<ActionResult<WinLossConfig[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listWinLossConfigs(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load win/loss configs.');
  }
}

/** Get the win/loss config for one object (null when none). Gated on `view`. */
export async function getWinLossConfigTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<WinLossConfig | null>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await getWinLossConfig(g.ctx.projectId, objectSlug) };
  } catch (e) {
    return fail(e, 'Failed to load win/loss config.');
  }
}

/* -------------------------------------------------------------------------- */
/* Field provisioning                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort provisioning of the outcome + reason SELECT display fields on the
 * object. `addFieldTw` errors when a field already exists, which we swallow (the
 * field is already there from a prior enable). The SELECT options are rebuilt
 * from the config so re-enabling syncs the option lists.
 */
async function ensureWinLossFields(
  config: WinLossConfig,
  projectId: string,
): Promise<void> {
  const outcomeDef: FieldMetadata = {
    key: OUTCOME_FIELD,
    label: 'Outcome',
    type: 'SELECT',
    icon: 'Flag',
    inTable: true,
    description: 'Win/loss outcome derived from the deal stage.',
    options: [
      { value: 'won', label: 'Won', color: 'success' },
      { value: 'lost', label: 'Lost', color: 'danger' },
    ],
  };
  const winReasonDef: FieldMetadata = {
    key: WIN_REASON_FIELD,
    label: 'Win reason',
    type: 'SELECT',
    icon: 'Trophy',
    inTable: true,
    description: 'Why this deal was won.',
    options: config.winReasonOptions.map((o) => ({
      value: o.value,
      label: o.label,
      color: o.color,
    })),
  };
  const lossReasonDef: FieldMetadata = {
    key: LOSS_REASON_FIELD,
    label: 'Loss reason',
    type: 'SELECT',
    icon: 'XCircle',
    inTable: true,
    description: 'Why this deal was lost.',
    options: config.lossReasonOptions.map((o) => ({
      value: o.value,
      label: o.label,
      color: o.color,
    })),
  };
  // Swallow "already exists" — provisioning only matters on first enable.
  await addFieldTw(config.objectSlug, outcomeDef, projectId).catch(() => undefined);
  await addFieldTw(config.objectSlug, winReasonDef, projectId).catch(() => undefined);
  await addFieldTw(config.objectSlug, lossReasonDef, projectId).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Write                                                                       */
/* -------------------------------------------------------------------------- */

/** Create or update the win/loss config for an object. Gated on `edit`. */
export async function saveWinLossConfigTw(
  input: WinLossConfigInput,
  projectId?: string,
): Promise<ActionResult<WinLossConfig>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  if (!hasUsableStages(input)) {
    return { ok: false, error: 'Add at least one won or lost stage.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertWinLossConfig(g.ctx.projectId, input);
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save win/loss config.');
  }
}

/**
 * Enable win/loss capture for an object: persist the config AND provision the
 * outcome / winReason / lossReason SELECT fields on the object (best-effort).
 * Gated on `edit`. Idempotent — re-running syncs the option lists and swallows
 * "field already exists".
 */
export async function enableWinLossTw(
  input: WinLossConfigInput,
  projectId?: string,
): Promise<ActionResult<WinLossConfig>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  if (!hasUsableStages(input)) {
    return { ok: false, error: 'Add at least one won or lost stage.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertWinLossConfig(g.ctx.projectId, input);
    await ensureWinLossFields(saved, g.ctx.projectId);
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to enable win/loss capture.');
  }
}

/** Delete the win/loss config for an object. Gated on `edit`. */
export async function deleteWinLossConfigTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ objectSlug: string }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteWinLossConfig(g.ctx.projectId, objectSlug);
    if (!ok) return { ok: false, error: 'Config not found.' };
    return { ok: true, data: { objectSlug } };
  } catch (e) {
    return fail(e, 'Failed to delete win/loss config.');
  }
}
