'use server';

/**
 * SabCRM — stage-gate server actions (Zoho-Blueprint / Pipedrive-inspired).
 *
 * Pipeline stages may declare **entry gates** on the pipeline document
 * (see `rust/crates/sabcrm-pipelines`' `StageGovernance`):
 *
 *   - `requiredFields: string[]` — record `data.<key>`s that must be
 *     non-empty before a record may ENTER the stage;
 *   - `requiresApproval: boolean` — entering the stage raises an approval
 *     request (crate `sabcrm-approvals`, collection `sabcrm_approvals`)
 *     instead of moving immediately.
 *
 * {@link checkSabcrmStageMove} evaluates one attempted move and returns a
 * {@link SabcrmStageGateVerdict} shaped to feed the RecordBoard composite's
 * `canMove` prop (`{ ok:false }` snaps the card back; `message` becomes the
 * banner `reason`, `kind` matches `RecordBoardGateKind`). The actual gate
 * evaluation lives in `src/lib/sabcrm/stage-gates.server.ts`
 * ({@link evaluateSabcrmStageGate}) so non-session principals (the SabCRM
 * MCP server) can run the SAME logic; this action wires it to the
 * session-cookie Rust clients. The remaining actions run the approval
 * lifecycle: request → approve / reject → re-check (an `approved` request
 * for the same record + target stage satisfies the gate on the next
 * {@link checkSabcrmStageMove}).
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-pipelines.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed result
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown
 * value is normalised (gates fail CLOSED: an engine error yields a
 * `forbidden` verdict, never a silent pass).
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmPipelinesApi } from '@/lib/rust-client/sabcrm-pipelines';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmApprovalsApi } from '@/lib/rust-client/sabcrm-approvals';
import type {
  SabcrmApprovalEnvelope,
  SabcrmApprovalListParams,
  SabcrmApprovalListResponse,
  SabcrmRustApproval,
} from '@/lib/rust-client/sabcrm-approvals';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  evaluateSabcrmStageGate,
  type SabcrmStageGateDeps,
} from '@/lib/sabcrm/stage-gates.server';
import type {
  RequestSabcrmStageApprovalInput,
  SabcrmApprovalDecision,
  SabcrmStageGateVerdict,
} from './sabcrm-stage-gates.actions.types';

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
// Gate (session → project → RBAC → plan) — mirrors sabcrm-pipelines.actions
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
 * helper in `sabcrm-pipelines.actions.ts` verbatim, including the
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
// Gate evaluation — delegated to the shared server lib
// ---------------------------------------------------------------------------

/**
 * The session-cookie dependency bundle for
 * {@link evaluateSabcrmStageGate} — wires the shared gate evaluator to the
 * same Rust clients this module's actions use (auth minted from the
 * session cookie by `rustFetch`).
 */
const sessionGateDeps: SabcrmStageGateDeps = {
  listPipelines: (projectId) => sabcrmPipelinesApi.list(projectId),
  getRecord: (object, id, projectId) =>
    sabcrmRecordsApi.get(object, id, projectId),
  listApprovals: (projectId, params) =>
    sabcrmApprovalsApi.list(projectId, params),
};

// ---------------------------------------------------------------------------
// checkSabcrmStageMove — the canMove verdict
// ---------------------------------------------------------------------------

/**
 * Evaluates whether `recordId` may ENTER `toStageId` right now.
 *
 * 1. loads the project's pipelines and picks the one governing
 *    (`objectSlug`, `toStageId`) — when none declares the stage there are no
 *    gates and the verdict is `{ ok: true }` (the move endpoint still
 *    validates stage membership server-side);
 * 2. loads the record and checks the stage's `requiredFields` for emptiness
 *    → `{ ok:false, kind:'required-fields', missing }`;
 * 3. when the stage `requiresApproval`, looks for an `approved` request for
 *    this exact (record → stage) move — found ⇒ the gate is satisfied;
 *    a `pending` one ⇒ `kind:'approval'` with its id; none ⇒
 *    `kind:'approval'` (the UI should call
 *    {@link requestSabcrmStageApproval}).
 *
 * Gates fail CLOSED: auth / engine errors yield `kind:'forbidden'`.
 * Evaluation itself is the shared {@link evaluateSabcrmStageGate}
 * (`src/lib/sabcrm/stage-gates.server.ts`) run over the session-cookie
 * clients — this action contributes the session → project → RBAC → plan
 * gate on top.
 *
 * Feed it to the RecordBoard's `canMove` prop via:
 * `v.ok ? { ok:true } : { ok:false, reason: v.message, kind: v.kind }`.
 */
export async function checkSabcrmStageMove(
  projectId: string | undefined,
  objectSlug: string,
  recordId: string,
  toStageId: string,
): Promise<SabcrmStageGateVerdict> {
  if (!objectSlug || !recordId || !toStageId) {
    return {
      ok: false,
      kind: 'forbidden',
      message: 'objectSlug, recordId and toStageId are required.',
    };
  }

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, kind: 'forbidden', message: g.error };

  return evaluateSabcrmStageGate(sessionGateDeps, {
    projectId: g.ctx.projectId,
    objectSlug,
    recordId,
    toStageId,
  });
}

// ---------------------------------------------------------------------------
// Approval lifecycle
// ---------------------------------------------------------------------------

/**
 * Raises a `pending` approval request for one record's move into a gated
 * stage. Idempotent on the live gate: an identical pending request (same
 * record → same target stage) is returned with `created: false` instead of
 * duplicating.
 */
export async function requestSabcrmStageApproval(
  input: RequestSabcrmStageApprovalInput,
  projectId?: string,
): Promise<ActionResult<SabcrmApprovalEnvelope>> {
  if (
    !input?.objectSlug ||
    !input?.recordId ||
    !input?.pipelineId ||
    !input?.toStageId
  ) {
    return {
      ok: false,
      error: 'objectSlug, recordId, pipelineId and toStageId are required.',
    };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmApprovalsApi.create(g.ctx.projectId, {
      objectSlug: input.objectSlug,
      recordId: input.recordId,
      pipelineId: input.pipelineId,
      fromStageId: input.fromStageId,
      toStageId: input.toStageId,
      reason: input.reason,
    });
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to request stage approval.');
  }
}

/**
 * Decides one pending approval request (`approved` / `rejected`), with an
 * optional decider note. One-shot: an already-decided request errors. An
 * `approved` decision satisfies the approval gate on the next
 * {@link checkSabcrmStageMove} for that record + stage (the caller still
 * performs the actual move through the pipelines `moveRecord` surface).
 */
export async function decideSabcrmApproval(
  id: string,
  decision: SabcrmApprovalDecision,
  note?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustApproval>> {
  if (!id) return { ok: false, error: 'Approval id is required.' };
  if (decision !== 'approved' && decision !== 'rejected') {
    return { ok: false, error: 'Decision must be approved or rejected.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data =
      decision === 'approved'
        ? await sabcrmApprovalsApi.approve(g.ctx.projectId, id, note)
        : await sabcrmApprovalsApi.reject(g.ctx.projectId, id, note);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to decide approval.');
  }
}

/**
 * Lists the project's approval requests, newest first, optionally narrowed
 * by status / object / record / pipeline / target stage, paginated
 * (`limit` defaults to 50, capped at 200 server-side).
 */
export async function listSabcrmApprovals(
  params?: SabcrmApprovalListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmApprovalListResponse>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmApprovalsApi.list(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list approvals.');
  }
}
