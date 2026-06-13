'use server';

/**
 * SabCRM — record-types server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/record-types.server`. The `gate` /
 * `fail` helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`. Reads gate on
 * `view`; writes/config gate on `edit` (there is no `manage` permission).
 *
 * `enableRecordTypesTw` additionally provisions the `recordTypeId` (SELECT)
 * field on the target object via the existing `addFieldTw` metadata action (the
 * Rust path — two-store gotcha) whose options are the object's active record
 * types, and re-provisions those options whenever the record-type set changes.
 * Best-effort and idempotent; never fails the save.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  listRecordTypes,
  getRecordTypesForObject,
  upsertRecordType,
  deleteRecordType,
  RECORD_TYPE_FIELD_KEY,
  type RecordType,
  type RecordTypeInput,
} from '@/lib/sabcrm/record-types.server';
import { addFieldTw, updateObjectTw, getObjectTw } from './sabcrm-objects.actions';

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
/* Field provisioning                                                          */
/* -------------------------------------------------------------------------- */

/** Build the `recordTypeId` SELECT field, options = the object's record types. */
function recordTypeFieldDef(recordTypes: RecordType[]): FieldMetadata {
  return {
    key: RECORD_TYPE_FIELD_KEY,
    label: 'Record type',
    type: 'SELECT',
    icon: 'Boxes',
    inTable: true,
    description: 'The record-type variant constraining picklists + layout.',
    options: recordTypes.map((rt) => ({ value: rt.id, label: rt.name })),
  };
}

/**
 * Provision (or refresh) the `recordTypeId` SELECT field on an object so its
 * options stay in sync with the object's record types. `addFieldTw` errors when
 * the field already exists (swallowed); on the second pass we PATCH the existing
 * field's `options` via `updateObjectTw`. Best-effort throughout.
 */
async function provisionRecordTypeField(
  projectId: string,
  object: string,
  recordTypes: RecordType[],
): Promise<void> {
  const def = recordTypeFieldDef(recordTypes);
  // First-enable path: create the field. Already-exists → fall through to PATCH.
  await addFieldTw(object, def, projectId).catch(() => undefined);
  // Refresh the existing field's options (idempotent for the create path too).
  try {
    const objRes = await getObjectTw(object, projectId);
    if (!objRes.ok) return;
    const fields = objRes.data.fields.map((f) =>
      f.key === RECORD_TYPE_FIELD_KEY ? { ...f, options: def.options } : f,
    );
    await updateObjectTw(object, { fields }, projectId).catch(() => undefined);
  } catch {
    /* best-effort */
  }
}

/* -------------------------------------------------------------------------- */
/* Read                                                                        */
/* -------------------------------------------------------------------------- */

/** List every record type in the active project. Gated on `view`. */
export async function listRecordTypesTw(
  projectId?: string,
): Promise<ActionResult<RecordType[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listRecordTypes(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load record types.');
  }
}

/** List the record types for one object. Gated on `view`. */
export async function listRecordTypesForObjectTw(
  object: string,
  activeOnly?: boolean,
  projectId?: string,
): Promise<ActionResult<RecordType[]>> {
  if (!object) return { ok: false, error: 'An object is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await getRecordTypesForObject(g.ctx.projectId, object, activeOnly === true),
    };
  } catch (e) {
    return fail(e, 'Failed to load record types.');
  }
}

/* -------------------------------------------------------------------------- */
/* Write / config (gate 'edit')                                               */
/* -------------------------------------------------------------------------- */

/**
 * Create or update a record type. Gated on `edit` (data-model management, same
 * as `addFieldTw`). After saving, re-provisions the object's `recordTypeId`
 * SELECT field options so they reflect the current variant set (best-effort).
 */
export async function saveRecordTypeTw(
  input: RecordTypeInput,
  projectId?: string,
): Promise<ActionResult<RecordType>> {
  if (!input?.object) return { ok: false, error: 'An object is required.' };
  if (!input.name?.trim()) return { ok: false, error: 'A name is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertRecordType(g.ctx.projectId, input);
    const all = await getRecordTypesForObject(g.ctx.projectId, saved.object, true);
    await provisionRecordTypeField(g.ctx.projectId, saved.object, all);
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save record type.');
  }
}

/**
 * Delete a record type by id. Gated on `edit`. Re-provisions the object's
 * `recordTypeId` field options afterwards so the deleted variant disappears
 * from new-record pickers (best-effort).
 */
export async function deleteRecordTypeTw(
  id: string,
  object: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A record type id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteRecordType(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Record type not found.' };
    if (object) {
      const all = await getRecordTypesForObject(g.ctx.projectId, object, true);
      await provisionRecordTypeField(g.ctx.projectId, object, all);
    }
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete record type.');
  }
}

/**
 * Enable record types on an object: provisions the `recordTypeId` SELECT field
 * (the Rust path — two-store gotcha) whose options are the object's active
 * record types. Idempotent: safe to call repeatedly (the field create is
 * swallowed if it already exists; options are refreshed each call). Gated on
 * `edit`.
 */
export async function enableRecordTypesTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<{ object: string; provisioned: boolean }>> {
  if (!object) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const all = await getRecordTypesForObject(g.ctx.projectId, object, true);
    await provisionRecordTypeField(g.ctx.projectId, object, all);
    return { ok: true, data: { object, provisioned: true } };
  } catch (e) {
    return fail(e, 'Failed to enable record types.');
  }
}
