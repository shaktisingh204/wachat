'use server';

/**
 * SabCRM — territory management server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/territory.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * Gating, exactly like scoring:
 *   - reads (`list*`, `accessUserIds`) → `view`.
 *   - writes / config (territory CRUD, enforcement flag) → `edit`.
 *
 * On save of an enabled territory tree, `saveTerritoryTw` best-effort (a)
 * provisions a `territoryId` SELECT display field on the object via the existing
 * `addFieldTw` metadata action (the Rust path — two-store gotcha) so the records
 * table/board renders the stamp, and (b) re-stamps existing records so saving
 * takes effect immediately, not only on the next mutation. Both never fail the
 * save.
 *
 * SECURITY: `setTerritoryEnforcementTw` flips the DEFAULT-OFF per-project access
 * enforcement flag. Turning it ON wires `territoryAccessUserIds` into the
 * native-TS records read path (see the snippet in this file's footer comment),
 * which can only NARROW a viewer's results. It must be enabled deliberately with
 * a security review on a running app; the action gates on `edit` and the flag
 * stays off until someone explicitly sets it.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  listTerritories,
  upsertTerritory,
  deleteTerritory,
  assignTerritoriesForObject,
  isTerritoryEnforcementEnabled,
  setTerritoryEnforcementEnabled,
  territoryAccessUserIds,
  TERRITORY_FIELD,
  type Territory,
  type TerritoryInput,
} from '@/lib/sabcrm/territory.server';
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

/* -------------------------------------------------------------------------- */
/* Reads (gated `view`)                                                        */
/* -------------------------------------------------------------------------- */

/** List the project's territories (optionally one object). Gated on `view`. */
export async function listTerritoriesTw(
  objectSlug?: string,
  projectId?: string,
): Promise<ActionResult<Territory[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listTerritories(g.ctx.projectId, objectSlug) };
  } catch (e) {
    return fail(e, 'Failed to load territories.');
  }
}

/** Read the DEFAULT-OFF access enforcement flag. Gated on `view`. */
export async function getTerritoryEnforcementTw(
  projectId?: string,
): Promise<ActionResult<{ enabled: boolean }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: { enabled: await isTerritoryEnforcementEnabled(g.ctx.projectId) },
    };
  } catch (e) {
    return fail(e, 'Failed to load territory settings.');
  }
}

/* -------------------------------------------------------------------------- */
/* Writes / config (gated `edit`)                                             */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort provisioning of the `territoryId` SELECT display field on the
 * object so the stamp renders in the records table/board. Idempotent-ish:
 * `addFieldTw` errors when the field already exists, which we swallow.
 */
async function ensureTerritoryField(
  objectSlug: string,
  territories: Territory[],
  projectId: string,
): Promise<void> {
  const def: FieldMetadata = {
    key: TERRITORY_FIELD,
    label: 'Territory',
    type: 'SELECT',
    icon: 'Map',
    inTable: true,
    description: 'Territory assigned by SabCRM territory rules.',
    options: territories.map((t) => ({ value: t.id, label: t.name })),
  };
  await addFieldTw(objectSlug, def, projectId).catch(() => undefined);
}

/**
 * Create or update a territory. Gated on `edit` (data-model management, same as
 * `addFieldTw`). On an enabled territory, provisions the display field and
 * re-stamps existing records (both best-effort).
 */
export async function saveTerritoryTw(
  input: TerritoryInput,
  projectId?: string,
): Promise<ActionResult<Territory>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertTerritory(g.ctx.projectId, input);
    if (saved.enabled) {
      const all = await listTerritories(g.ctx.projectId, saved.objectSlug);
      await ensureTerritoryField(saved.objectSlug, all, g.ctx.projectId);
      await assignTerritoriesForObject(g.ctx.projectId, saved.objectSlug).catch(
        () => undefined,
      );
    }
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save territory.');
  }
}

/** Delete a territory by id (children re-parent up). Gated on `edit`. */
export async function deleteTerritoryTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A territory id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteTerritory(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Territory not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete territory.');
  }
}

/** Manually re-stamp every record of an object. Gated on `edit`. */
export async function reassignTerritoriesTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ scanned: number; updated: number }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await assignTerritoriesForObject(g.ctx.projectId, objectSlug),
    };
  } catch (e) {
    return fail(e, 'Failed to reassign territories.');
  }
}

/**
 * Flip the DEFAULT-OFF territory access enforcement flag. Gated on `edit`.
 * SECURITY: enabling wires the territory access roll-up into the native-TS
 * records read path (NARROWING only) — do this deliberately with a review.
 */
export async function setTerritoryEnforcementTw(
  enabled: boolean,
  projectId?: string,
): Promise<ActionResult<{ enabled: boolean }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    await setTerritoryEnforcementEnabled(g.ctx.projectId, enabled === true);
    return { ok: true, data: { enabled: enabled === true } };
  } catch (e) {
    return fail(e, 'Failed to update territory settings.');
  }
}

/**
 * The owner user-ids the current viewer may see via the territories they
 * manage. Gated on `view`. Pure read of the roll-up; does NOT enforce anything.
 * Exposed for diagnostics / the settings UI ("who can this manager see").
 */
export async function getTerritoryAccessUserIdsTw(
  projectId?: string,
): Promise<ActionResult<{ userIds: string[] }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: { userIds: await territoryAccessUserIds(g.ctx.projectId, g.ctx.userId) },
    };
  } catch (e) {
    return fail(e, 'Failed to resolve territory access.');
  }
}

/* ==========================================================================
 * INTEGRATION SNIPPETS (NOT applied here — orchestrator wires centrally)
 * ==========================================================================
 *
 * (1) twentyActions-style stamp hook — add to sabcrm-twenty.actions.ts right
 *     beside the existing `recomputeScoresForRecord` calls in BOTH the create
 *     and update flows (best-effort; writes data.territoryId WITHOUT bumping
 *     updatedAt):
 *
 *       import { assignTerritoryForRecord } from '@/lib/sabcrm/territory.server';
 *       // ...after recomputeScoresForRecord(g.ctx.projectId, object, record.id):
 *       await assignTerritoryForRecord(g.ctx.projectId, object, record.id);
 *       // (update flow uses the record id var, e.g. `id` / `primaryId`)
 *
 * (2) read-path fold-in — in records.server.ts `buildFilter`, FLAG-GATED and
 *     DEFAULT-OFF, fold the territory owners into the existing accessible-owner
 *     `$or`. This is NARROWING only and must stay behind the per-project flag.
 *     Because buildFilter is synchronous, resolve the ids in the async caller
 *     (listRecords/getRecord) and pass them down:
 *
 *       // in listRecords(), before buildFilter — only when enforcement is on:
 *       let territoryOwnerIds: string[] | undefined;
 *       if (await isTerritoryEnforcementEnabled(projectId)) {
 *         territoryOwnerIds = await territoryAccessUserIds(projectId, userId);
 *       }
 *       // then, when composing the owner `$or` (private mode), UNION:
 *       //   ids = [...new Set([...visibleUserIds, ...(territoryOwnerIds ?? [])])]
 *       // When the flag is OFF, territoryOwnerIds is undefined → filter is
 *       // byte-for-byte identical to today (no narrowing, no widening).
 *
 *     GAP: this attaches to the native-TS read path ONLY. The Rust read path is
 *     NOT covered automatically and would need its own equivalent fold-in.
 *     Reviewer must verify on a running app before enabling the flag.
 * ========================================================================== */
