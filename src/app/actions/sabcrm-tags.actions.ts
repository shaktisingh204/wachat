'use server';

/**
 * SabCRM — tags server actions.
 *
 * Thin, gated wrappers over the Rust tags engine
 * ({@link sabcrmTagsApi} in `@/lib/rust-client/sabcrm-tags`). These power the
 * workspace tag / label management surface (define `name` + `color`, scoped to
 * a project, with a per-project unique `name`).
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
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmTagsApi } from '@/lib/rust-client/sabcrm-tags';
import type { SabcrmRustTag } from '@/lib/rust-client/sabcrm-tags';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreateTagTwInput,
  UpdateTagTwPatch,
} from './sabcrm-tags.actions.types';

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
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-views.actions.ts` verbatim, including the cross-tenant
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
// Tags CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the tags for a project through the Rust engine. */
export async function listTagsTw(
  projectId?: string,
): Promise<ActionResult<SabcrmRustTag[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTagsApi.list(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list tags.');
  }
}

/** Creates a tag (rejects a duplicate name per project). */
export async function createTagTw(
  input: CreateTagTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTag>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const tag = await sabcrmTagsApi.create(g.ctx.projectId, input);
    return { ok: true, data: tag };
  } catch (e) {
    return fail(e, 'Failed to create tag.');
  }
}

/** Partial-updates a tag (name / color). */
export async function updateTagTw(
  id: string,
  patch: UpdateTagTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTag>> {
  if (!id) return { ok: false, error: 'Tag id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const tag = await sabcrmTagsApi.update(g.ctx.projectId, id, patch);
    return { ok: true, data: tag };
  } catch (e) {
    return fail(e, 'Failed to update tag.');
  }
}

/**
 * The standard objects a tag can be applied to. The list-page tag picker stores
 * applied tag ids on each record's `data.__tags` array (NOT the Rust
 * `sabcrm_tag_assignments` join table), so the delete guard counts membership
 * over `data.__tags` through the same engine the records live in. An equality
 * filter on an array field matches records whose array *contains* the value.
 */
const TAGGABLE_OBJECTS = ['companies', 'people', 'leads', 'notes', 'tasks'] as const;

/**
 * Counts how many records currently carry a given tag id (across the standard
 * taggable objects). Used to guard {@link deleteTagTw}.
 */
export async function tagUsageCountTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ count: number }>> {
  if (!id) return { ok: false, error: 'Tag id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const counts = await Promise.all(
      TAGGABLE_OBJECTS.map((object) =>
        sabcrmRecordsApi
          .count(object, { projectId: g.ctx.projectId, filters: { __tags: id } })
          .then((r) => r.count)
          .catch(() => 0),
      ),
    );
    const total = counts.reduce((a, b) => a + b, 0);
    return { ok: true, data: { count: total } };
  } catch (e) {
    return fail(e, 'Failed to count tag usage.');
  }
}

/**
 * Deletes a tag by id — but only when it is not assigned to any record.
 * Mirrors the user requirement: a tag can't be deleted while it is still in use.
 */
export async function deleteTagTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Tag id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // Guard: refuse to delete a tag that is still applied to records. Counting
    // happens through the engine so it reflects the canonical record store.
    const counts = await Promise.all(
      TAGGABLE_OBJECTS.map((object) =>
        sabcrmRecordsApi
          .count(object, { projectId: g.ctx.projectId, filters: { __tags: id } })
          .then((r) => r.count)
          .catch(() => 0),
      ),
    );
    const inUse = counts.reduce((a, b) => a + b, 0);
    if (inUse > 0) {
      return {
        ok: false,
        error: `This tag is assigned to ${inUse} record${inUse === 1 ? '' : 's'}. Remove it from them before deleting.`,
      };
    }

    const res = await sabcrmTagsApi.remove(g.ctx.projectId, id);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete tag.');
  }
}
