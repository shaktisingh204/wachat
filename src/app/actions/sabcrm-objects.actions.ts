'use server';

/**
 * SabCRM — Twenty UI "Data Model" server actions.
 *
 * Thin, gated wrappers over the Rust *objects* engine
 * ({@link sabcrmObjectsApi} in `@/lib/rust-client/sabcrm-objects`). These power
 * the Twenty-faithful Data Model settings screen under
 * `/sabcrm/settings/data-model`, where an admin browses the object catalogue
 * (standard + custom) and manages each object's fields.
 *
 * Every action follows the SAME pipeline as the sibling `sabcrm-twenty.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *      (defense-in-depth against the fail-open RBAC resolver)
 *   3. RBAC check via `canServer('sabcrm', action, projectId)` — reads gate on
 *      `view`, every mutation gates on `edit` (the "admin" capability)
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the Data Model UI can degrade
 * gracefully (loading / empty / error states) and never crashes.
 *
 * `addFieldTw` / `removeFieldTw` are convenience helpers implemented on top of
 * `updateObjectTw`: they read the current object, append / drop a field in
 * `fields`, and PATCH the whole array back.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmObjectsApi,
  type SabcrmObjectUpdateInput,
} from '@/lib/rust-client/sabcrm-objects';
import type {
  ActionResult,
  ObjectMetadata,
  FieldMetadata,
} from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Settings path revalidated after mutations so the UI re-fetches. */
const DATA_MODEL_PATH = '/sabcrm/settings/data-model';

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
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-twenty.actions.ts` verbatim, including the cross-tenant
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

  // 2. active project — only accept a projectId that belongs to THIS user
  // (the shared RBAC resolver fails open for non-members; deny instead).
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
// Objects — CRUD via the Rust engine
// ---------------------------------------------------------------------------

/** `GET /v1/sabcrm/objects` — merged standard + custom object catalogue. */
export async function listObjectsTw(
  projectId?: string,
): Promise<ActionResult<ObjectMetadata[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmObjectsApi.list(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list objects.');
  }
}

/** `GET /v1/sabcrm/objects/{slug}` — one merged object. */
export async function getObjectTw(
  slug: string,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmObjectsApi.get(slug, g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load object.');
  }
}

/** `POST /v1/sabcrm/objects` — create a custom object. */
export async function createObjectTw(
  object: ObjectMetadata,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!object?.slug?.trim()) {
    return { ok: false, error: 'Object slug is required.' };
  }
  if (!object.labelSingular?.trim() || !object.labelPlural?.trim()) {
    return { ok: false, error: 'Singular and plural labels are required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmObjectsApi.create(g.ctx.projectId, object);
    revalidatePath(DATA_MODEL_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create object.');
  }
}

/** `PATCH /v1/sabcrm/objects/{slug}` — partial update of a custom object. */
export async function updateObjectTw(
  slug: string,
  patch: SabcrmObjectUpdateInput,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmObjectsApi.update(g.ctx.projectId, slug, patch);
    revalidatePath(DATA_MODEL_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update object.');
  }
}

/** `DELETE /v1/sabcrm/objects/{slug}` — delete a custom object. */
export async function deleteObjectTw(
  slug: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmObjectsApi.remove(g.ctx.projectId, slug);
    revalidatePath(DATA_MODEL_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete object.');
  }
}

// ---------------------------------------------------------------------------
// Field convenience helpers (implemented via updateObjectTw)
// ---------------------------------------------------------------------------

/**
 * Append a custom field to an object. Reads the current object, validates the
 * field key is not already taken, then PATCHes the whole `fields` array back.
 * Gates on `edit` (admin) like every mutation.
 */
export async function addFieldTw(
  slug: string,
  field: FieldMetadata,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!field?.key?.trim()) return { ok: false, error: 'Field key is required.' };
  if (!field.label?.trim()) return { ok: false, error: 'Field label is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmObjectsApi.get(slug, g.ctx.projectId);
    const key = field.key.trim();
    if (current.fields.some((f) => f.key === key)) {
      return { ok: false, error: `A field named “${key}” already exists.` };
    }
    const nextFields: FieldMetadata[] = [
      ...current.fields,
      { ...field, key },
    ];
    const data = await sabcrmObjectsApi.update(g.ctx.projectId, slug, {
      fields: nextFields,
    });
    revalidatePath(DATA_MODEL_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to add field.');
  }
}

/**
 * Remove a custom field from an object by key. Reads the current object, drops
 * the matching field from `fields`, then PATCHes the array back. The engine is
 * the source of truth for which fields are immutable (standard/system) and will
 * reject a removal it does not allow — surfaced here as an error result.
 */
export async function removeFieldTw(
  slug: string,
  fieldKey: string,
  projectId?: string,
): Promise<ActionResult<ObjectMetadata>> {
  if (!slug) return { ok: false, error: 'Object slug is required.' };
  if (!fieldKey) return { ok: false, error: 'Field key is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmObjectsApi.get(slug, g.ctx.projectId);
    if (!current.fields.some((f) => f.key === fieldKey)) {
      return { ok: false, error: 'Field not found.' };
    }
    const nextFields = current.fields.filter((f) => f.key !== fieldKey);
    const data = await sabcrmObjectsApi.update(g.ctx.projectId, slug, {
      fields: nextFields,
    });
    revalidatePath(DATA_MODEL_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to remove field.');
  }
}
