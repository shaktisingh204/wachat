'use server';

/**
 * SabCRM — sequence (cadence) server actions.
 *
 * Sequences are HubSpot/Close-style cadences (crate `sabcrm-sequences`,
 * collections `sabcrm_sequences` + `sabcrm_sequence_enrollments`): an
 * ordered list of email / task / wait steps that enrolled records walk
 * through. Execution happens in the SabCRM scheduler tick
 * (`src/lib/sabcrm/scheduler.ts`, cron `/api/cron/sabcrm-workflows`);
 * auto-unenroll hooks live in `src/lib/sabcrm/sequences.server.ts`.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-stage-gates.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed result
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown
 * value is normalised into an `{ ok: false, error }` result.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmSequencesApi } from '@/lib/rust-client/sabcrm-sequences';
import type {
  SabcrmEnrollmentListParams,
  SabcrmEnrollmentListResponse,
  SabcrmEnrollResponse,
  SabcrmRustEnrollment,
  SabcrmRustSequence,
  SabcrmSequenceListParams,
  SabcrmSequenceListResponse,
} from '@/lib/rust-client/sabcrm-sequences';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmSequenceBuilderInput,
  SabcrmSequenceEnrollInput,
  SabcrmSequencePatchInput,
} from './sabcrm-sequences.actions.types';

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
// Gate (session → project → RBAC → plan) — mirrors sabcrm-stage-gates.actions
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
 * helper in `sabcrm-stage-gates.actions.ts` verbatim, including the
 * cross-tenant defense against a client-supplied `explicitProjectId`.
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
// Sequence CRUD
// ---------------------------------------------------------------------------

/**
 * Lists the project's sequences, newest first, optionally narrowed by
 * status, paginated (`limit` defaults to 50, capped at 200 server-side).
 */
export async function listSabcrmSequences(
  params?: SabcrmSequenceListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmSequenceListResponse>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.list(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list sequences.');
  }
}

/** Fetches one sequence definition. */
export async function getSabcrmSequence(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustSequence>> {
  if (!id) return { ok: false, error: 'Sequence id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load the sequence.');
  }
}

/**
 * Creates a sequence definition. Steps are validated server-side for
 * executability (email needs a template or body; task a title; wait a
 * positive `waitDays`); `settings.unenrollOnReply` defaults to `true`.
 */
export async function createSabcrmSequence(
  input: SabcrmSequenceBuilderInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustSequence>> {
  if (!input?.name?.trim()) return { ok: false, error: 'Name is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.create(g.ctx.projectId, {
      name: input.name.trim(),
      steps: input.steps,
      settings: input.settings,
      status: input.status,
    });
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create the sequence.');
  }
}

/**
 * Partially updates a sequence (name / status pause-resume / steps /
 * settings). Structural fields are re-validated server-side.
 */
export async function updateSabcrmSequence(
  id: string,
  patch: SabcrmSequencePatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustSequence>> {
  if (!id) return { ok: false, error: 'Sequence id is required.' };
  if (!patch || Object.keys(patch).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.update(g.ctx.projectId, id, patch);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the sequence.');
  }
}

/**
 * Deletes a sequence. Its remaining active enrollments are unenrolled
 * server-side so the scheduler never picks up orphans.
 */
export async function deleteSabcrmSequence(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Sequence id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.remove(g.ctx.projectId, id);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to delete the sequence.');
  }
}

// ---------------------------------------------------------------------------
// Enrollment lifecycle
// ---------------------------------------------------------------------------

/**
 * Enrolls record(s) into a sequence. Idempotent per record: an already
 * actively-enrolled record is skipped (reported in `skipped`), never
 * duplicated. New enrollments run their first step on the scheduler's next
 * tick.
 */
export async function enrollSabcrmSequence(
  input: SabcrmSequenceEnrollInput,
  projectId?: string,
): Promise<ActionResult<SabcrmEnrollResponse>> {
  if (!input?.sequenceId) return { ok: false, error: 'Sequence id is required.' };
  if (!input?.objectSlug) return { ok: false, error: 'objectSlug is required.' };
  if (!input?.recordIds?.length) {
    return { ok: false, error: 'At least one record id is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.enroll(
      g.ctx.projectId,
      input.sequenceId,
      input.objectSlug,
      input.recordIds,
    );
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to enroll records.');
  }
}

/**
 * Manually stops one active enrollment. One-shot: completed / failed /
 * already-unenrolled enrollments error.
 */
export async function unenrollSabcrmEnrollment(
  enrollmentId: string,
  reason?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustEnrollment>> {
  if (!enrollmentId) return { ok: false, error: 'Enrollment id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.unenroll(
      g.ctx.projectId,
      enrollmentId,
      reason,
    );
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to unenroll.');
  }
}

/**
 * Lists the project's enrollments, newest first, optionally narrowed by
 * sequence / record / status, paginated.
 */
export async function listSabcrmSequenceEnrollments(
  params?: SabcrmEnrollmentListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmEnrollmentListResponse>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmSequencesApi.listEnrollments(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list enrollments.');
  }
}
