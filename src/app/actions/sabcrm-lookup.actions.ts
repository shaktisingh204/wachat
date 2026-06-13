'use server';

/**
 * SabCRM — lookup fields server actions.
 *
 * Gated wrappers over `@/lib/sabcrm/lookup.server`. Saving an enabled lookup
 * (a) provisions the TARGET field on the child object via the existing
 * `addFieldTw` metadata path, MIRRORING the parent source field's type (read
 * through the Rust object surface — the two-store-safe metadata read), and
 * (b) recomputes the object's records so the mirror takes effect immediately,
 * not only on the next mutation. Both are best-effort and never fail the save.
 *
 * Gate / fail copied verbatim from `sabcrm-scoring.actions.ts`: session →
 * project membership (rejecting a client-supplied projectId the caller is not a
 * member of) → RBAC `canServer('sabcrm', …)` → plan. Reads gate `view`;
 * writes / config gate `edit` (there is no `manage` action).
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata, FieldType } from '@/lib/sabcrm/types';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import {
  listLookups,
  upsertLookup,
  deleteLookup,
  recomputeLookupsForObject,
  type LookupField,
  type LookupFieldInput,
} from '@/lib/sabcrm/lookup.server';
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
  if (!myProjectIds.has(requested)) return { ok: false, error: 'Permission denied.' };
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
 * Resolve the parent SOURCE field's metadata via the Rust object surface (the
 * two-store-safe read). Returns null when the parent object / source field can't
 * be found, so provisioning falls back to a plain TEXT mirror.
 */
async function findParentSourceField(
  projectId: string,
  parentObject: string,
  sourceKey: string,
): Promise<FieldMetadata | null> {
  try {
    const obj = await sabcrmObjectsApi.get(parentObject, projectId);
    return (obj.fields.find((f) => f.key === sourceKey) as FieldMetadata) ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort provisioning of the mirrored TARGET field on the child object.
 * The target inherits the parent source field's TYPE (+ SELECT/MULTI_SELECT
 * options so values render with their colours). `addFieldTw` errors when the
 * field already exists, which we swallow — provisioning only matters on the
 * first enable.
 */
async function ensureLookupField(
  f: LookupField,
  projectId: string,
): Promise<void> {
  const parentField = await findParentSourceField(
    projectId,
    f.parentObject,
    f.sourceKey,
  );
  // A lookup must NOT mirror a RELATION/computed type as itself; mirror the
  // displayed scalar instead (fall back to TEXT for anything non-scalar).
  const mirrorableType: FieldType = pickMirrorType(parentField?.type);
  const def: FieldMetadata = {
    key: f.targetKey,
    label: f.name || parentField?.label || f.targetKey,
    type: mirrorableType,
    icon: 'Link2',
    inTable: true,
    description: `Lookup: ${f.parentObject}.${f.sourceKey} via ${f.relationField}`,
    options:
      mirrorableType === 'SELECT' || mirrorableType === 'MULTI_SELECT'
        ? parentField?.options
        : undefined,
  };
  await addFieldTw(f.objectSlug, def, projectId).catch(() => undefined);
}

/** Map a parent field type to a safe mirror type for the copied scalar. */
function pickMirrorType(parentType: FieldType | undefined): FieldType {
  switch (parentType) {
    case 'NUMBER':
    case 'NUMERIC':
    case 'CURRENCY':
    case 'BOOLEAN':
    case 'DATE':
    case 'DATE_TIME':
    case 'EMAIL':
    case 'PHONE':
    case 'LINK':
    case 'SELECT':
    case 'MULTI_SELECT':
    case 'RATING':
    case 'TEXT':
      return parentType;
    // RELATION / FILE / composites / AI mirror their displayed value as TEXT.
    default:
      return 'TEXT';
  }
}

/** List every lookup field in the active project. Gated on `view`. */
export async function listLookupsTw(
  projectId?: string,
): Promise<ActionResult<LookupField[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listLookups(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load lookup fields.');
  }
}

/**
 * Create or update a lookup field. On an enabled lookup, provisions the mirrored
 * target field and recomputes the object's records (both best-effort). Gated on
 * `edit` (data-model management, same as `addFieldTw`).
 */
export async function saveLookupTw(
  input: LookupFieldInput,
  projectId?: string,
): Promise<ActionResult<LookupField>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  if (!input?.relationField?.trim()) {
    return { ok: false, error: 'A relation field is required.' };
  }
  if (!input?.parentObject?.trim()) {
    return { ok: false, error: 'A parent object is required.' };
  }
  if (!input?.sourceKey?.trim()) {
    return { ok: false, error: 'A parent source field is required.' };
  }
  if (!input?.targetKey?.trim()) {
    return { ok: false, error: 'A target field key is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertLookup(g.ctx.projectId, input);
    if (saved.enabled) {
      await ensureLookupField(saved, g.ctx.projectId);
      await recomputeLookupsForObject(g.ctx.projectId, saved.objectSlug).catch(
        () => undefined,
      );
    }
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save lookup field.');
  }
}

/**
 * Enable (or re-enable) a lookup field: provision the mirrored target field and
 * backfill the object's records. A thin convenience over `saveLookupTw` for the
 * settings toggle. Gated on `edit`.
 */
export async function enableLookupTw(
  input: LookupFieldInput,
  projectId?: string,
): Promise<ActionResult<LookupField>> {
  return saveLookupTw({ ...input, enabled: true }, projectId);
}

/** Delete a lookup field definition by id. Gated on `edit`. */
export async function deleteLookupTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A lookup id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteLookup(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Lookup field not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete lookup field.');
  }
}

/** Manually re-sync all lookups for an object's records. Gated on `edit`. */
export async function recomputeLookupsTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ scanned: number; updated: number }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await recomputeLookupsForObject(g.ctx.projectId, objectSlug),
    };
  } catch (e) {
    return fail(e, 'Failed to recompute lookup fields.');
  }
}
