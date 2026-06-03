'use server';

/**
 * SabCRM — note / email / task templates server actions.
 *
 * Thin, gated wrappers over the Rust templates engine
 * ({@link sabcrmTemplatesApi} in `@/lib/rust-client/sabcrm-templates`). A
 * template is a reusable note / email / task body (`name`, `kind`, optional
 * `subject`, `body`) scoped by `projectId`.
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
import { sabcrmTemplatesApi } from '@/lib/rust-client/sabcrm-templates';
import type { SabcrmRustTemplate } from '@/lib/rust-client/sabcrm-templates';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreateTemplateTwInput,
  UpdateTemplateTwPatch,
} from './sabcrm-templates.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the UI re-fetches. */
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
// Templates CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the templates for a project, optionally filtered by kind. */
export async function listTemplatesTw(
  kind?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTemplate[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTemplatesApi.list(g.ctx.projectId, kind);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list templates.');
  }
}

/** Fetches a single template by id. */
export async function getTemplateTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTemplate>> {
  if (!id) return { ok: false, error: 'Template id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTemplatesApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load template.');
  }
}

/** Creates a template. */
export async function createTemplateTw(
  input: CreateTemplateTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTemplate>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.kind?.trim()) return { ok: false, error: 'A kind is required.' };
  if (input?.body === undefined || input?.body === null) {
    return { ok: false, error: 'A body is required.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTemplatesApi.create(g.ctx.projectId, input);
    revalidatePath(`${TW_BASE_PATH}/templates`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create template.');
  }
}

/** Partial-updates a template (name, kind, subject, body). */
export async function updateTemplateTw(
  id: string,
  patch: UpdateTemplateTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustTemplate>> {
  if (!id) return { ok: false, error: 'Template id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmTemplatesApi.update(g.ctx.projectId, id, patch);
    revalidatePath(`${TW_BASE_PATH}/templates`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update template.');
  }
}

/** Deletes a template by id. */
export async function deleteTemplateTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Template id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmTemplatesApi.remove(g.ctx.projectId, id);
    revalidatePath(`${TW_BASE_PATH}/templates`);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete template.');
  }
}
