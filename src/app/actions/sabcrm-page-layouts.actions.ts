'use server';

/**
 * SabCRM — record-page-layout server actions.
 *
 * Thin, gated wrappers over the Rust page-layouts engine
 * ({@link sabcrmPageLayoutsApi} in `@/lib/rust-client/sabcrm-page-layouts`).
 * These power the configurable record-show page layout (tabs + widgets per
 * object: FIELDS, NOTES, TASKS, TIMELINE, FILES, RECORD_TABLE, RICH_TEXT,
 * GRAPH, IFRAME) on the Twenty-faithful record pages under
 * `/sabcrm/[objectSlug]`.
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
import { sabcrmPageLayoutsApi } from '@/lib/rust-client/sabcrm-page-layouts';
import type {
  SabcrmRustPageLayout,
  SabcrmLayoutTab,
  SabcrmPageLayoutType,
} from '@/lib/rust-client/sabcrm-page-layouts';
import type { ActionResult } from '@/lib/sabcrm/types';

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
// Page-layout CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/**
 * Reads the configured record-page layout for an object. A `404` from the
 * engine (no layout configured yet) is normalised to `{ ok: true, data: null }`
 * so callers can fall back to a default layout without treating it as an error.
 */
export async function getPageLayoutTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustPageLayout | null>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmPageLayoutsApi.get(g.ctx.projectId, object);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { ok: true, data: null };
    }
    return fail(e, 'Failed to load page layout.');
  }
}

/**
 * Reads the configured layout for an object, falling back to the server-built
 * **default** layout (an empty-`id`, `isDefault: true` body) instead of a
 * `404`/`null` when none is configured. Always resolves to a renderable
 * layout, so callers never need their own default-tab fallback.
 */
export async function getPageLayoutOrDefaultTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustPageLayout>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmPageLayoutsApi.get(g.ctx.projectId, object, {
      withDefault: true,
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load page layout.');
  }
}

/**
 * Returns the per-object server-built **default** layout (a Details tab + an
 * Activity tab of Notes/Tasks/Timeline) without touching any stored row. Used
 * by the editor's *Reset* preview.
 */
export async function getDefaultPageLayoutTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustPageLayout>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmPageLayoutsApi.getDefault(g.ctx.projectId, object);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load default page layout.');
  }
}

/**
 * Upserts the record-page layout (tabs + widgets) for an object. The optional
 * `pageLayoutType` selects which record surface the layout composes (`DETAIL`
 * for the record-show page, `FORM` for the create/edit surface); it defaults to
 * `DETAIL` server-side when omitted, matching the Rust `SaveLayoutInput`.
 */
export async function savePageLayoutTw(
  object: string,
  tabs: SabcrmLayoutTab[],
  projectId?: string,
  pageLayoutType?: SabcrmPageLayoutType,
): Promise<ActionResult<SabcrmRustPageLayout>> {
  if (!object) return { ok: false, error: 'Object is required.' };
  if (!Array.isArray(tabs)) {
    return { ok: false, error: 'Tabs must be an array.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const layout = await sabcrmPageLayoutsApi.save(
      g.ctx.projectId,
      object,
      tabs,
      pageLayoutType,
    );
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: layout };
  } catch (e) {
    return fail(e, 'Failed to save page layout.');
  }
}

/** Resets an object's record-page layout back to the default (deletes the row). */
export async function resetPageLayoutTw(
  object: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!object) return { ok: false, error: 'Object is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmPageLayoutsApi.reset(g.ctx.projectId, object);
    revalidatePath(`${TW_BASE_PATH}/${object}`);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to reset page layout.');
  }
}
