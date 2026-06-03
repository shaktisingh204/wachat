'use server';

/**
 * SabCRM — sales-pipelines server actions.
 *
 * Thin, gated wrappers over the Rust pipelines engine
 * ({@link sabcrmPipelinesApi} in `@/lib/rust-client/sabcrm-pipelines`). These
 * power the per-project pipeline editor (a name, a target `object`, and an
 * ordered list of stages, each `{ id, label, color }`).
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
import { sabcrmPipelinesApi } from '@/lib/rust-client/sabcrm-pipelines';
import type { SabcrmRustPipeline } from '@/lib/rust-client/sabcrm-pipelines';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreatePipelineTwInput,
  UpdatePipelineTwPatch,
} from './sabcrm-pipelines.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the SabCRM UI re-fetches. */
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
// Pipelines CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the sales pipelines for the active project through the Rust engine. */
export async function listPipelinesTw(
  projectId?: string,
): Promise<ActionResult<SabcrmRustPipeline[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmPipelinesApi.list(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list pipelines.');
  }
}

/** Fetches a single pipeline by id. */
export async function getPipelineTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustPipeline>> {
  if (!id) return { ok: false, error: 'Pipeline id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmPipelinesApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load pipeline.');
  }
}

/** Creates a sales pipeline. */
export async function createPipelineTw(
  input: CreatePipelineTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustPipeline>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmPipelinesApi.create(g.ctx.projectId, input);
    revalidatePath(`${TW_BASE_PATH}/pipelines`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create pipeline.');
  }
}

/** Partial-updates a sales pipeline (name, object, stages, isDefault). */
export async function updatePipelineTw(
  id: string,
  patch: UpdatePipelineTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustPipeline>> {
  if (!id) return { ok: false, error: 'Pipeline id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmPipelinesApi.update(g.ctx.projectId, id, patch);
    revalidatePath(`${TW_BASE_PATH}/pipelines`);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update pipeline.');
  }
}

/** Deletes a sales pipeline by id. */
export async function deletePipelineTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Pipeline id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmPipelinesApi.remove(g.ctx.projectId, id);
    revalidatePath(`${TW_BASE_PATH}/pipelines`);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete pipeline.');
  }
}
