/**
 * SabCRM Stage Gates — server-action types.
 *
 * A 'use server' module may export ONLY async functions, so every non-async
 * type the stage-gate actions surface to their (client) callers lives in this
 * plain sibling module. Importing it has no runtime cost.
 *
 * The central type is {@link SabcrmStageGateVerdict} — the result of
 * evaluating a record's attempted move into a pipeline stage against the
 * stage's entry gates (`requiredFields` + `requiresApproval`, declared on
 * the pipeline document; see `rust/crates/sabcrm-pipelines`'
 * `StageGovernance`). It is shaped to feed the RecordBoard composite's
 * `canMove` prop (`RecordBoardGateVerdict` in
 * `src/components/sabcrm/20ui/composites/record/board.tsx`):
 *
 * ```ts
 * // adapt a SabcrmStageGateVerdict to RecordBoardGateVerdict:
 * const v = await checkSabcrmStageMove(projectId, object, record.id, toColumnId);
 * if (v.ok) return { ok: true };
 * return { ok: false, reason: v.message, kind: v.kind };
 * //  v.kind: 'required-fields' | 'approval' | 'forbidden'
 * //  — the exact RecordBoardGateKind union.
 * ```
 */

export type {
  SabcrmApprovalStatus,
  SabcrmRustApproval,
  SabcrmApprovalListParams,
  SabcrmApprovalListResponse,
  SabcrmApprovalCreateInput,
} from '@/lib/rust-client/sabcrm-approvals';

/**
 * Verdict of one attempted stage move, mirroring the board's
 * `RecordBoardGateKind` union:
 *
 * - `{ ok: true }` — the move may proceed (call the pipelines `moveRecord`).
 * - `kind: 'required-fields'` — the record is missing the listed
 *   `data.<key>`s the target stage requires; surface a fill-in form.
 * - `kind: 'approval'` — the target stage requires an approval; raise one
 *   via `requestSabcrmStageApproval` instead of moving.
 * - `kind: 'forbidden'` — the move can never proceed as-is (auth/tenancy
 *   failure, unknown stage, unknown record …).
 *
 * Every blocked verdict carries a human-readable `message` (the board shows
 * it as the snap-back banner `reason`).
 */
export type SabcrmStageGateVerdict =
  | { ok: true }
  | {
      ok: false;
      kind: 'required-fields';
      /** Field keys (inside `record.data`) that are still empty. */
      missing: string[];
      message: string;
    }
  | {
      ok: false;
      kind: 'approval';
      message: string;
      /**
       * Id of the already-pending approval request for this exact move, when
       * one exists (lets the UI link to it instead of re-requesting).
       */
      pendingApprovalId?: string;
    }
  | { ok: false; kind: 'forbidden'; message: string };

/** Input accepted by {@link requestSabcrmStageApproval}. */
export interface RequestSabcrmStageApprovalInput {
  /** Funnel object slug the record belongs to (e.g. `"leads"`). */
  objectSlug: string;
  /** Hex id of the record awaiting the move. */
  recordId: string;
  /** Pipeline the target stage belongs to. */
  pipelineId: string;
  /** Stage the record currently sits in, if known. */
  fromStageId?: string;
  /** Stage the record wants to ENTER (the gated stage). */
  toStageId: string;
  /** Requester's free-text justification. */
  reason?: string;
}

/** Decision verb accepted by {@link decideSabcrmApproval}. */
export type SabcrmApprovalDecision = 'approved' | 'rejected';
