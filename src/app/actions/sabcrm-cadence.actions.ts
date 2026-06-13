'use server';

/**
 * SabCRM — multichannel cadence template server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/cadences.server` (config CRUD for the
 * `sabcrm_cadences` collection) + a `testSendCadenceStepTw` that fires ONE step
 * of a template against a real record through `dispatchCadenceStep`
 * (`@/lib/sabcrm/cadence-channels.server`). The `gate` / `fail` helpers are
 * copied verbatim from `sabcrm-scoring.actions.ts` (session → project membership
 * → RBAC `canServer('sabcrm', …)` → plan), including the cross-tenant defense
 * against a client-supplied `projectId`.
 *
 * Gating: reads use `view`; saves / deletes / the test-send (a config-validation
 * action that also CONSUMES a send) use `edit` — there is no `manage` action in
 * the RBAC vocabulary, so `edit` is the config gate (matches the scoring
 * actions exactly).
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listCadenceTemplates,
  getCadenceTemplate,
  upsertCadenceTemplate,
  deleteCadenceTemplate,
  type CadenceTemplate,
  type CadenceTemplateInput,
} from '@/lib/sabcrm/cadences.server';
import {
  dispatchCadenceStep,
  type DispatchResult,
} from '@/lib/sabcrm/cadence-channels.server';
import {
  enrollRecordInCadence,
  unenrollFromCadence,
  listEnrollmentsForRecord,
  type CadenceEnrollment,
} from '@/lib/sabcrm/cadence-runner.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions.ts). */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  if (!(await canServer(MODULE_KEY, action, requested))) {
    return { ok: false, error: 'Permission denied.' };
  }
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/* -------------------------------------------------------------------------- */
/* Config CRUD                                                                 */
/* -------------------------------------------------------------------------- */

/** List every multichannel cadence template in the active project. Gated `view`. */
export async function listCadencesTw(
  projectId?: string,
): Promise<ActionResult<CadenceTemplate[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listCadenceTemplates(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load cadences.');
  }
}

/** Create or update a cadence template. Gated `edit` (config management). */
export async function saveCadenceTw(
  input: CadenceTemplateInput,
  projectId?: string,
): Promise<ActionResult<CadenceTemplate>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertCadenceTemplate(g.ctx.projectId, input);
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save the cadence.');
  }
}

/** Delete a cadence template by id. Gated `edit`. */
export async function deleteCadenceTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A cadence id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteCadenceTemplate(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Cadence not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete the cadence.');
  }
}

/* -------------------------------------------------------------------------- */
/* Test send                                                                   */
/* -------------------------------------------------------------------------- */

/** Result of a test send: the dispatch outcome for the chosen step. */
export interface TestSendResult {
  channel: string;
  outcome: string;
  ok: boolean;
}

/**
 * Fire ONE step of a saved cadence against a real record so an admin can
 * verify the channel wiring end-to-end before enrolling anyone. Gated `edit`
 * (it consumes a real send + is a config-validation tool).
 *
 * The dispatch is run with a NEGATIVE pseudo step index so it never collides
 * with (and never dedupes against) a real enrollment's ledger slot — a test
 * send always fires fresh and is recorded under its own throwaway enrollment id.
 */
export async function testSendCadenceStepTw(
  cadenceId: string,
  stepId: string,
  objectSlug: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<TestSendResult>> {
  if (!cadenceId || !stepId) {
    return { ok: false, error: 'A cadence and step are required.' };
  }
  if (!objectSlug || !recordId) {
    return { ok: false, error: 'A test record is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const template = await getCadenceTemplate(g.ctx.projectId, cadenceId);
    if (!template) return { ok: false, error: 'Cadence not found.' };
    const step = template.steps.find((s) => s.id === stepId);
    if (!step) return { ok: false, error: 'Step not found in this cadence.' };

    // Throwaway enrollment id + no stepIndex → the dispatcher skips the
    // idempotency ledger (dedupeIndex < 0), so the test always sends fresh.
    const enrollmentId = `test:${cadenceId}:${stepId}:${Date.now()}`;
    const result: DispatchResult = await dispatchCadenceStep(g.ctx.projectId, {
      id: enrollmentId,
      userId: g.ctx.userId,
      projectId: g.ctx.projectId,
      objectSlug,
      recordId,
    }, step);

    return {
      ok: true,
      data: { channel: step.channel, outcome: result.outcome, ok: result.ok },
    };
  } catch (e) {
    return fail(e, 'Test send failed.');
  }
}

/* -------------------------------------------------------------------------- */
/* Enrollment (records flow through a cadence, advanced by the cron runner)     */
/* -------------------------------------------------------------------------- */

/**
 * Enroll a record into a cadence. Gated `edit`. Idempotent — a record already
 * active in the same cadence is returned as-is. The cron
 * (`/api/cron/sabcrm-cadences`) advances it step-by-step thereafter. Sends are
 * attributed to the enroller's identity.
 */
export async function enrollInCadenceTw(
  cadenceId: string,
  objectSlug: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<CadenceEnrollment>> {
  if (!cadenceId) return { ok: false, error: 'A cadence is required.' };
  if (!objectSlug || !recordId) {
    return { ok: false, error: 'A record is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await enrollRecordInCadence(
      g.ctx.projectId,
      cadenceId,
      objectSlug,
      recordId,
      g.ctx.userId,
    );
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, data: res.enrollment };
  } catch (e) {
    return fail(e, 'Failed to enroll the record.');
  }
}

/** Stop an active cadence enrollment. Gated `edit`. */
export async function unenrollFromCadenceTw(
  enrollmentId: string,
  projectId?: string,
): Promise<ActionResult<{ enrollmentId: string }>> {
  if (!enrollmentId) return { ok: false, error: 'An enrollment is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await unenrollFromCadence(g.ctx.projectId, enrollmentId);
    if (!ok) return { ok: false, error: 'Enrollment not found or already ended.' };
    return { ok: true, data: { enrollmentId } };
  } catch (e) {
    return fail(e, 'Failed to unenroll the record.');
  }
}

/** List a record's cadence enrollments (newest first). Gated `view`. */
export async function listRecordCadenceEnrollmentsTw(
  objectSlug: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<CadenceEnrollment[]>> {
  if (!objectSlug || !recordId) {
    return { ok: false, error: 'A record is required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await listEnrollmentsForRecord(
      g.ctx.projectId,
      objectSlug,
      recordId,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load enrollments.');
  }
}
