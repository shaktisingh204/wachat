import 'server-only';

/**
 * SabCRM — stage-gate evaluation (Zoho-Blueprint / Pipedrive-inspired).
 *
 * Pipeline stages may declare **entry gates** on the pipeline document
 * (see `rust/crates/sabcrm-pipelines`' `StageGovernance`):
 *
 *   - `requiredFields: string[]` — record `data.<key>`s that must be
 *     non-empty before a record may ENTER the stage;
 *   - `requiresApproval: boolean` — entering the stage raises an approval
 *     request (crate `sabcrm-approvals`) instead of moving immediately.
 *
 * {@link evaluateSabcrmStageGate} is the single authoritative evaluator.
 * It is **auth-agnostic**: the caller supplies a {@link SabcrmStageGateDeps}
 * bundle wired to whichever Rust transport its principal uses —
 *
 *   - the `checkSabcrmStageMove` server action injects the session-cookie
 *     clients (`sabcrmPipelinesApi` / `sabcrmRecordsApi` /
 *     `sabcrmApprovalsApi`);
 *   - the SabCRM MCP server (`/api/mcp/sabcrm`) injects `rustFetchAsUser`
 *     wrappers minted for the API-key owner.
 *
 * Gates fail CLOSED: any thrown value (incl. {@link RustApiError}) is
 * normalised into a `forbidden` verdict — an unevaluable gate never waves a
 * move through. The verdict shape ({@link SabcrmStageGateVerdict}) lives in
 * `src/app/actions/sabcrm-stage-gates.actions.types.ts` so existing client
 * consumers keep their import path.
 */

import { RustApiError } from '@/lib/rust-client/fetcher';
import type {
  SabcrmRustPipeline,
  SabcrmRustPipelineStage,
} from '@/lib/rust-client/sabcrm-pipelines';
import type { SabcrmRustRecord } from '@/lib/rust-client/sabcrm-records';
import type {
  SabcrmApprovalListParams,
  SabcrmApprovalListResponse,
} from '@/lib/rust-client/sabcrm-approvals';
import type { SabcrmStageGateVerdict } from '@/app/actions/sabcrm-stage-gates.actions.types';

// ---------------------------------------------------------------------------
// Dependency bundle — the three Rust reads a gate evaluation may perform
// ---------------------------------------------------------------------------

/**
 * The Rust reads {@link evaluateSabcrmStageGate} may perform, abstracted so
 * the same logic runs under session-cookie auth (server actions) and
 * API-key auth (the MCP server). Every member mirrors the corresponding
 * `sabcrm*Api` client method's signature exactly.
 */
export interface SabcrmStageGateDeps {
  /** `GET /v1/sabcrm/pipelines` — the project's pipelines. */
  listPipelines(projectId: string): Promise<SabcrmRustPipeline[]>;
  /** `GET /v1/sabcrm/records/{object}/{id}` — one record (unenriched). */
  getRecord(
    object: string,
    id: string,
    projectId: string,
  ): Promise<SabcrmRustRecord>;
  /** `GET /v1/sabcrm/approvals` — filtered approval-request page. */
  listApprovals(
    projectId: string,
    params: SabcrmApprovalListParams,
  ): Promise<SabcrmApprovalListResponse>;
}

/** One attempted stage move to evaluate. */
export interface SabcrmStageGateMove {
  projectId: string;
  /** Funnel object slug the record belongs to (e.g. `"leads"`). */
  objectSlug: string;
  /** Hex id of the record attempting the move. */
  recordId: string;
  /** Stage the record wants to ENTER (the potentially gated stage). */
  toStageId: string;
}

// ---------------------------------------------------------------------------
// Gate evaluation helpers
// ---------------------------------------------------------------------------

/**
 * Is a record `data` value "empty" for required-field purposes? Mirrors the
 * Sabbigin governance semantics: `undefined` / `null`, blank / whitespace
 * strings and empty arrays are empty; `0` and `false` are NOT (they are
 * legitimate field values).
 */
export function isEmptyFieldValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Pick the pipeline whose board this move belongs to: targets `objectSlug`
 * AND declares `toStageId` among its stages. Prefers the default pipeline
 * when several match (mirrors how the board page resolves its pipeline).
 */
export function findGoverningPipeline(
  pipelines: SabcrmRustPipeline[],
  objectSlug: string,
  toStageId: string,
): SabcrmRustPipeline | undefined {
  const candidates = pipelines.filter(
    (p) =>
      p.object === objectSlug &&
      (p.stages ?? []).some((s) => String(s.id) === toStageId),
  );
  return candidates.find((p) => p.isDefault) ?? candidates[0];
}

/** The target stage descriptor inside one pipeline, by stringified id. */
export function findStage(
  pipeline: SabcrmRustPipeline,
  toStageId: string,
): SabcrmRustPipelineStage | undefined {
  return (pipeline.stages ?? []).find((s) => String(s.id) === toStageId);
}

/** Normalises a thrown value into the fail-closed `forbidden` message. */
function gateFailureMessage(e: unknown, fallback: string): string {
  if (e instanceof RustApiError) return e.message || fallback;
  return e instanceof Error ? e.message : fallback;
}

// ---------------------------------------------------------------------------
// evaluateSabcrmStageGate — the canMove verdict
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
 *    `kind:'approval'` (the caller should raise an approval request).
 *
 * Gates fail CLOSED: engine errors yield `kind:'forbidden'`. Auth /
 * tenancy gating happens UPSTREAM (the caller resolves and validates the
 * principal + projectId before invoking this).
 */
export async function evaluateSabcrmStageGate(
  deps: SabcrmStageGateDeps,
  move: SabcrmStageGateMove,
): Promise<SabcrmStageGateVerdict> {
  const { projectId, objectSlug, recordId, toStageId } = move;

  if (!objectSlug || !recordId || !toStageId) {
    return {
      ok: false,
      kind: 'forbidden',
      message: 'objectSlug, recordId and toStageId are required.',
    };
  }

  try {
    const pipelines = await deps.listPipelines(projectId);
    const pipeline = findGoverningPipeline(pipelines, objectSlug, toStageId);
    const stage = pipeline ? findStage(pipeline, toStageId) : undefined;

    // No pipeline declares this stage → no gates to enforce here.
    if (!pipeline || !stage) return { ok: true };

    // --- required-field gate -------------------------------------------
    const requiredFields = stage.requiredFields ?? [];
    if (requiredFields.length > 0) {
      const record = await deps.getRecord(objectSlug, recordId, projectId);
      const data = record.data ?? {};
      const missing = requiredFields.filter((key) =>
        isEmptyFieldValue(data[key]),
      );
      if (missing.length > 0) {
        const label = stage.label || toStageId;
        return {
          ok: false,
          kind: 'required-fields',
          missing,
          message: `Fill ${missing.join(', ')} before moving to "${label}".`,
        };
      }
    }

    // --- approval gate ---------------------------------------------------
    if (stage.requiresApproval) {
      // An approved request for this exact move satisfies the gate.
      const approved = await deps.listApprovals(projectId, {
        status: 'approved',
        objectSlug,
        recordId,
        toStageId,
        limit: 1,
      });
      if (approved.total > 0) return { ok: true };

      const label = stage.label || toStageId;
      // Surface an already-pending request so the UI can link to it.
      const pending = await deps.listApprovals(projectId, {
        status: 'pending',
        objectSlug,
        recordId,
        toStageId,
        limit: 1,
      });
      if (pending.total > 0) {
        return {
          ok: false,
          kind: 'approval',
          message: `Approval to enter "${label}" is pending.`,
          pendingApprovalId: pending.approvals[0]?.id,
        };
      }

      return {
        ok: false,
        kind: 'approval',
        message: `Entering "${label}" requires approval.`,
      };
    }

    return { ok: true };
  } catch (e) {
    // Fail CLOSED — a gate that cannot be evaluated must not wave moves
    // through.
    return {
      ok: false,
      kind: 'forbidden',
      message: gateFailureMessage(e, 'Could not evaluate stage gates.'),
    };
  }
}
