'use server';

/**
 * SabCRM — saved-segments (smart lists) server actions.
 *
 * Thin, gated wrappers over the Rust segments engine
 * ({@link sabcrmSegmentsApi} in `@/lib/rust-client/sabcrm-segments`). A segment
 * is a saved smart list: a named object + filter definition (optional sort +
 * color). These power the per-object smart-list switcher on the
 * Twenty-faithful index pages under `/sabcrm/[objectSlug]`.
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

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmSegmentsApi } from '@/lib/rust-client/sabcrm-segments';
import type { SabcrmRustSegment } from '@/lib/rust-client/sabcrm-segments';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreateSegmentTwInput,
  UpdateSegmentTwPatch,
} from './sabcrm-segments.actions.types';

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
// Segments CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the saved segments (optionally narrowed by object) via the engine. */
export async function listSegmentsTw(
  object?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustSegment[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSegmentsApi.list(g.ctx.projectId, object);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list segments.');
  }
}

/** Fetches a single saved segment by id. */
export async function getSegmentTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustSegment>> {
  if (!id) return { ok: false, error: 'Segment id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSegmentsApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load segment.');
  }
}

/** Creates a saved segment for an object. */
export async function createSegmentTw(
  input: CreateSegmentTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustSegment>> {
  if (!input?.object) return { ok: false, error: 'Object is required.' };
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const segment = await sabcrmSegmentsApi.create(g.ctx.projectId, input);
    revalidatePath(`${TW_BASE_PATH}/${input.object}`);
    return { ok: true, data: segment };
  } catch (e) {
    return fail(e, 'Failed to create segment.');
  }
}

/** Partial-updates a saved segment (name, filters, sort, color, …). */
export async function updateSegmentTw(
  id: string,
  patch: UpdateSegmentTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustSegment>> {
  if (!id) return { ok: false, error: 'Segment id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const segment = await sabcrmSegmentsApi.update(g.ctx.projectId, id, patch);
    if (typeof segment.object === 'string' && segment.object) {
      revalidatePath(`${TW_BASE_PATH}/${segment.object}`);
    }
    return { ok: true, data: segment };
  } catch (e) {
    return fail(e, 'Failed to update segment.');
  }
}

/** Deletes a saved segment by id. */
export async function deleteSegmentTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Segment id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmSegmentsApi.remove(g.ctx.projectId, id);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete segment.');
  }
}
