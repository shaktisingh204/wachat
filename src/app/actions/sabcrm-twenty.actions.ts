'use server';

/**
 * SabCRM — Twenty UI slice server actions.
 *
 * Thin, gated wrappers over the Rust records engine
 * ({@link sabcrmRecordsApi} in `@/lib/rust-client/sabcrm-records`). These power
 * the Twenty-faithful index + detail pages under `/sabcrm/[objectSlug]`.
 *
 * Every action follows the SAME pipeline as the native `sabcrm.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *      (defense-in-depth against the fail-open RBAC resolver)
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI can degrade gracefully
 * (empty/error states) and never crashes.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmActivitiesApi } from '@/lib/rust-client/sabcrm-activities';
import { sabcrmFavoritesApi } from '@/lib/rust-client/sabcrm-favorites';
import type { SabcrmRustActivity } from '@/lib/rust-client/sabcrm-activities';
import type { SabcrmRustFavorite } from '@/lib/rust-client/sabcrm-favorites';
import {
  listObjects,
  ensureStandardObjects,
} from '@/lib/sabcrm/objects.server';
import type { ActionResult, ObjectMetadata } from '@/lib/sabcrm/types';
import type {
  ListSabcrmRecordsTwParams,
  SabcrmRecordsTwPage,
  SabcrmRecordTwGroups,
  SabcrmRustRecord,
  ListSabcrmActivitiesTwParams,
  CreateSabcrmActivityTwInput,
  UpdateSabcrmActivityTwPatch,
} from './sabcrm-twenty.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the Twenty UI re-fetches. */
const TW_BASE_PATH = '/sabcrm';

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
 * helper in `sabcrm.actions.ts` verbatim, including the cross-tenant defense
 * against a client-supplied `explicitProjectId`.
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
// Object metadata
// ---------------------------------------------------------------------------

/**
 * Lists the standard + custom objects for the active project. Reuses the
 * native metadata layer (the schema source of truth) so the Twenty pages share
 * one object catalogue with the native CRM.
 */
export async function listSabcrmObjectsTw(
  projectId?: string,
): Promise<ActionResult<ObjectMetadata[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // Idempotent seed so the object catalogue exists from the first read.
    await ensureStandardObjects(g.ctx.projectId);
    const data = await listObjects(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list objects.');
  }
}

// ---------------------------------------------------------------------------
// Records — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists / searches / paginates records of an object through the Rust engine. */
export async function listSabcrmRecordsTw(
  object: string,
  params: ListSabcrmRecordsTwParams = {},
  projectId?: string,
): Promise<ActionResult<SabcrmRecordsTwPage>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.list(object, {
      projectId: g.ctx.projectId,
      q: params.q,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
      page: params.page,
      limit: params.limit,
    });
    return { ok: true, data: { records: res.records, total: res.total } };
  } catch (e) {
    return fail(e, 'Failed to list records.');
  }
}

/** Fetches a single record by id through the Rust engine. */
export async function getSabcrmRecordTw(
  object: string,
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRecordsApi.get(object, id, g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load record.');
  }
}

/** Creates a new record on the given object. */
export async function createSabcrmRecordTw(
  object: string,
  data: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const record = await sabcrmRecordsApi.create(object, {
      projectId: g.ctx.projectId,
      data: data ?? {},
      createdBy: g.ctx.userId,
    });
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to create record.');
  }
}

/** Merge-updates a record's `data` (used by inline edit). */
export async function updateSabcrmRecordTw(
  object: string,
  id: string,
  data: Record<string, unknown>,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRecord>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const record = await sabcrmRecordsApi.update(object, id, {
      projectId: g.ctx.projectId,
      data: data ?? {},
    });
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    revalidatePath(`${TW_BASE_PATH}/${object}/${id}`);
    return { ok: true, data: record };
  } catch (e) {
    return fail(e, 'Failed to update record.');
  }
}

/** Deletes a record by id. */
export async function deleteSabcrmRecordTw(
  object: string,
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!id) return { ok: false, error: 'Record id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.remove(object, id, g.ctx.projectId);
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete record.');
  }
}

/** Groups records of an object by a SELECT field (kanban board). */
export async function groupSabcrmRecordsTw(
  object: string,
  groupByField: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRecordTwGroups>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!groupByField) return { ok: false, error: 'A group-by field is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRecordsApi.group(
      object,
      g.ctx.projectId,
      groupByField,
    );
    return { ok: true, data: { groups: res.groups } };
  } catch (e) {
    return fail(e, 'Failed to group records.');
  }
}

// ---------------------------------------------------------------------------
// Activities (timeline) — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists a record's timeline activities (newest first) through the engine. */
export async function listSabcrmActivitiesTw(
  targetObject: string,
  recordId: string,
  opts: ListSabcrmActivitiesTwParams = {},
  projectId?: string,
): Promise<ActionResult<SabcrmRustActivity[]>> {
  if (!targetObject) return { ok: false, error: 'Object is required.' };
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const activities = await sabcrmActivitiesApi.list({
      projectId: g.ctx.projectId,
      targetObject,
      targetRecordId: recordId,
      type: opts.type,
      limit: opts.limit,
    });
    return { ok: true, data: activities };
  } catch (e) {
    return fail(e, 'Failed to load timeline.');
  }
}

/** Creates a timeline activity; `authorId` is the current user. */
export async function createSabcrmActivityTw(
  input: CreateSabcrmActivityTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustActivity>> {
  if (!input.targetObject) return { ok: false, error: 'Object is required.' };
  if (!input.targetRecordId) {
    return { ok: false, error: 'Record id is required.' };
  }
  if (!input.type?.trim()) return { ok: false, error: 'A type is required.' };
  if (!input.title?.trim()) return { ok: false, error: 'A title is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const activity = await sabcrmActivitiesApi.create({
      projectId: g.ctx.projectId,
      type: input.type.trim(),
      title: input.title.trim(),
      body: input.body,
      targetObject: input.targetObject,
      targetRecordId: input.targetRecordId,
      authorId: g.ctx.userId,
      status: input.status,
      assigneeId: input.assigneeId,
      dueAt: input.dueAt,
    });
    revalidatePath(
      `${TW_BASE_PATH}/${input.targetObject}/${input.targetRecordId}`,
    );
    return { ok: true, data: activity };
  } catch (e) {
    return fail(e, 'Failed to add activity.');
  }
}

/** Partial-updates a timeline activity (e.g. task status). */
export async function updateSabcrmActivityTw(
  id: string,
  patch: UpdateSabcrmActivityTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustActivity>> {
  if (!id) return { ok: false, error: 'Activity id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const activity = await sabcrmActivitiesApi.update(id, {
      projectId: g.ctx.projectId,
      ...patch,
    });
    return { ok: true, data: activity };
  } catch (e) {
    return fail(e, 'Failed to update activity.');
  }
}

/** Deletes a timeline activity by id. */
export async function deleteSabcrmActivityTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Activity id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmActivitiesApi.remove(id, g.ctx.projectId);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete activity.');
  }
}

// ---------------------------------------------------------------------------
// Favorites — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the caller's favorites for the active project (newest first). */
export async function listSabcrmFavoritesTw(
  projectId?: string,
): Promise<ActionResult<SabcrmRustFavorite[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const favorites = await sabcrmFavoritesApi.list(g.ctx.projectId);
    return { ok: true, data: favorites };
  } catch (e) {
    return fail(e, 'Failed to load favorites.');
  }
}

/** Adds (upserts) a favorite for the caller. Idempotent. */
export async function addSabcrmFavoriteTw(
  object: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustFavorite>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const favorite = await sabcrmFavoritesApi.add(
      g.ctx.projectId,
      object,
      recordId,
    );
    return { ok: true, data: favorite };
  } catch (e) {
    return fail(e, 'Failed to add favorite.');
  }
}

/** Removes a favorite for the caller. Idempotent. */
export async function removeSabcrmFavoriteTw(
  object: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!recordId) return { ok: false, error: 'Record id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFavoritesApi.remove(
      g.ctx.projectId,
      object,
      recordId,
    );
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to remove favorite.');
  }
}
