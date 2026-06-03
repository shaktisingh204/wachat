'use server';

/**
 * SabCRM — automation-workflows server actions.
 *
 * Thin, gated wrappers over the Rust workflows engine
 * ({@link sabcrmWorkflowsApi} in `@/lib/rust-client/sabcrm-workflows`). These
 * power the CRM automation surface: per-project rules that fire a sequence of
 * steps in response to record lifecycle events (`record.created` /
 * `record.updated` / `record.deleted`).
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
 *
 * Read actions gate on `view`; create/edit/delete gate on `create` / `edit` /
 * `delete`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmWorkflowsApi } from '@/lib/rust-client/sabcrm-workflows';
import type { SabcrmRustWorkflow } from '@/lib/rust-client/sabcrm-workflows';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreateWorkflowTwInput,
  UpdateWorkflowTwPatch,
} from './sabcrm-workflows.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the automation UI re-fetches. */
const TW_BASE_PATH = '/sabcrm/workflows';

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
// Workflows CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the automation workflows for the active project. */
export async function listWorkflowsTw(
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmWorkflowsApi.list(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list workflows.');
  }
}

/** Fetches one workflow by id. */
export async function getWorkflowTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflow>> {
  if (!id) return { ok: false, error: 'Workflow id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmWorkflowsApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load workflow.');
  }
}

/** Creates an automation workflow. */
export async function createWorkflowTw(
  input: CreateWorkflowTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflow>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };
  if (!input?.trigger?.event || !input?.trigger?.object) {
    return { ok: false, error: 'A trigger event and object are required.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const workflow = await sabcrmWorkflowsApi.create(g.ctx.projectId, input);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: workflow };
  } catch (e) {
    return fail(e, 'Failed to create workflow.');
  }
}

/**
 * Partial-updates a workflow (name, trigger, steps, enabled, …). Covers
 * enable/disable toggles and step edits.
 */
export async function updateWorkflowTw(
  id: string,
  patch: UpdateWorkflowTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflow>> {
  if (!id) return { ok: false, error: 'Workflow id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const workflow = await sabcrmWorkflowsApi.update(g.ctx.projectId, id, patch);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: workflow };
  } catch (e) {
    return fail(e, 'Failed to update workflow.');
  }
}

/** Deletes a workflow by id. */
export async function deleteWorkflowTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Workflow id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmWorkflowsApi.remove(g.ctx.projectId, id);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete workflow.');
  }
}
