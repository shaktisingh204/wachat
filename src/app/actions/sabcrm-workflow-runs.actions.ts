'use server';

/**
 * SabCRM — workflow-runs server actions.
 *
 * Thin, gated wrappers over the Rust workflow-runs engine
 * ({@link sabcrmWorkflowRunsApi} in `@/lib/rust-client/sabcrm-workflow-runs`).
 * These power the durable run-history surface for SabCRM workflows: a list of
 * past/current executions and per-step status (`running` | `success` |
 * `failed`).
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
import { sabcrmWorkflowRunsApi } from '@/lib/rust-client/sabcrm-workflow-runs';
import type { SabcrmRustWorkflowRun } from '@/lib/rust-client/sabcrm-workflow-runs';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreateWorkflowRunTwInput,
  UpdateWorkflowRunTwPatch,
} from './sabcrm-workflow-runs.actions.types';

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
// Workflow-runs — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists workflow runs (newest first) for one workflow through the Rust engine. */
export async function listWorkflowRunsTw(
  workflowId: string,
  limit?: number,
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflowRun[]>> {
  if (!workflowId) return { ok: false, error: 'Workflow id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmWorkflowRunsApi.list(g.ctx.projectId, {
      workflowId,
      limit,
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list workflow runs.');
  }
}

/** Fetches a single workflow run by id. */
export async function getWorkflowRunTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflowRun>> {
  if (!id) return { ok: false, error: 'Run id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmWorkflowRunsApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load workflow run.');
  }
}

/** Creates a workflow run (records the start of an execution). */
export async function createWorkflowRunTw(
  input: CreateWorkflowRunTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflowRun>> {
  if (!input?.workflowId) return { ok: false, error: 'Workflow id is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const run = await sabcrmWorkflowRunsApi.create(g.ctx.projectId, input);
    revalidatePath(`${TW_BASE_PATH}/workflows/${input.workflowId}`);
    return { ok: true, data: run };
  } catch (e) {
    return fail(e, 'Failed to create workflow run.');
  }
}

/** Partial-updates a workflow run (status, steps, finishedAt, …). */
export async function updateWorkflowRunTw(
  id: string,
  patch: UpdateWorkflowRunTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustWorkflowRun>> {
  if (!id) return { ok: false, error: 'Run id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const run = await sabcrmWorkflowRunsApi.update(g.ctx.projectId, id, patch);
    if (typeof run.workflowId === 'string' && run.workflowId) {
      revalidatePath(`${TW_BASE_PATH}/workflows/${run.workflowId}`);
    }
    return { ok: true, data: run };
  } catch (e) {
    return fail(e, 'Failed to update workflow run.');
  }
}
