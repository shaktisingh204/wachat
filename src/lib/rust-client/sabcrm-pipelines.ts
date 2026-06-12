import 'server-only';

/**
 * SabCRM Pipelines client — wraps the Rust `/v1/sabcrm/pipelines` surface
 * (crate `sabcrm-pipelines`, mounted by `sabnode-api`).
 *
 * A pipeline is a named, per-project sales funnel targeting one `object`
 * (default `"opportunities"`) with an ordered list of stages, each
 * `{ id, label, color }`. Tenant scope is `projectId`; the Rust side requires a
 * valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ pipelines: [...] }` (list) and
 * `{ pipeline: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-pipelines/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';
import type { SabcrmRustRecord } from './sabcrm-records';

/**
 * Explicit stage classification. `'won'` / `'lost'` mark terminal stages
 * (powering the lost-reason dialog and win/loss reporting without label
 * heuristics); `'open'` is the explicit in-flight marker. Legacy stages omit
 * the key entirely.
 */
export type SabcrmStageKind = 'open' | 'won' | 'lost';

/**
 * A single stage within a pipeline, including its optional **entry gates**
 * (stage governance — Zoho-Blueprint / Pipedrive-inspired). All governance
 * keys are additive: legacy stages persisted as bare `{ id, label, color }`
 * simply omit them (the Rust side serde-defaults them to the permissive
 * baseline — see `rust/crates/sabcrm-pipelines/src/dto.rs` `StageGovernance`).
 */
export interface SabcrmRustPipelineStage {
  id: string;
  label: string;
  color?: string;
  /**
   * Record `data.<key>`s that must be non-empty before a record may ENTER
   * this stage. Empty / omitted → no required-field gate.
   */
  requiredFields?: string[];
  /**
   * Entering this stage raises an approval request (see
   * `sabcrm-approvals`) instead of moving immediately.
   */
  requiresApproval?: boolean;
  /** Idle-days threshold for the deal-rotting UI. Omitted → never rots. */
  rottingDays?: number;
  /**
   * Explicit stage classification (`'open' | 'won' | 'lost'`). Omitted on
   * legacy stages — consumers may fall back to label heuristics.
   */
  kind?: SabcrmStageKind;
  /**
   * Win probability of records in this stage, in **percent** (0–100). Drives
   * the weighted forecast (`weighted = amount × probability / 100`). Omitted →
   * unset; consumers fall back to a kind/position-based default (see
   * `sabcrm-forecast.actions.ts`).
   */
  probability?: number;
}

/** A SabCRM pipeline as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustPipeline {
  id: string;
  projectId: string;
  name: string;
  /** Target object slug. Defaults to "opportunities" server-side. */
  object: string;
  stages: SabcrmRustPipelineStage[];
  isDefault?: boolean;
  /**
   * Marking a record lost requires a reason (one of {@link lostReasons}
   * when that list is non-empty). Omitted → reason optional.
   */
  lostReasonRequired?: boolean;
  /** Curated list of allowed lost reasons. Omitted/empty → free text. */
  lostReasons?: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /` body sans `projectId` — the flattened pipeline document. Sent as
 * `{ projectId, ...input }`. `object` defaults to `"opportunities"` and
 * `stages` defaults to `[]` server-side.
 */
export interface SabcrmPipelineCreateInput {
  name: string;
  object?: string;
  stages?: SabcrmRustPipelineStage[];
  isDefault?: boolean;
  /** Marking a record lost requires a reason. */
  lostReasonRequired?: boolean;
  /** Curated list of allowed lost reasons. */
  lostReasons?: string[];
}

/** `PATCH /{id}` body sans `projectId` — a partial pipeline document. */
export interface SabcrmPipelineUpdateInput {
  [key: string]: unknown;
}

/** Raw `{ pipelines }` envelope from `GET /`. */
interface ListEnvelope {
  pipelines: SabcrmRustPipeline[];
}

/** Raw `{ pipeline }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SingleEnvelope {
  pipeline: SabcrmRustPipeline;
}

// ---------------------------------------------------------------------------
// Board depth — stages with live counts/amounts, reorder, move-record-to-stage
// ---------------------------------------------------------------------------

/** Options for {@link sabcrmPipelinesApi.board}. */
export interface SabcrmPipelineBoardOpts {
  /**
   * `data.<field>` on the target object holding the stage id. Defaults to
   * `"stage"` server-side.
   */
  stageField?: string;
  /**
   * `data.<field>` on the target object holding the numeric amount summed
   * per stage. Defaults to `"amount"` server-side.
   */
  amountField?: string;
}

/**
 * One column of the pipeline board: the stage descriptor (id/label/color,
 * carried verbatim from the pipeline document) plus the live per-stage
 * rollups computed from `sabcrm_records`.
 */
export interface SabcrmPipelineBoardStage {
  /** Stage id (always a string on the wire; numeric ids are stringified). */
  id: string;
  /** Human label, if the pipeline document carried one. */
  label?: string;
  /** Stage color, if the pipeline document carried one. */
  color?: string;
  /** Zero-based position of the stage within the ordered pipeline. */
  position: number;
  /** Number of live records currently in this stage. */
  count: number;
  /** Sum of the amount field across the records in this stage. */
  amount: number;
  /**
   * Record `data.<key>`s required to ENTER this stage (entry gate).
   * Omitted on the wire when the stage declares none.
   */
  requiredFields?: string[];
  /**
   * Entering this stage raises an approval request instead of moving
   * immediately. Omitted on the wire when `false`.
   */
  requiresApproval?: boolean;
  /** Idle-days threshold for the deal-rotting UI, if declared. */
  rottingDays?: number;
  /** Explicit stage classification, if declared. Omitted when absent. */
  kind?: SabcrmStageKind;
  /** Win probability in percent (0–100), if declared. Omitted when absent. */
  probability?: number;
}

/**
 * `GET /{id}/board` response — the pipeline document plus its ordered,
 * rolled-up stages, an `unassigned` tail bucket (records whose stage value
 * matches no declared stage) and grand totals.
 */
export interface SabcrmPipelineBoardResponse {
  pipeline: SabcrmRustPipeline;
  /** Stages in pipeline order, each carrying its live count + amount. */
  stages: SabcrmPipelineBoardStage[];
  /** Rollup of records whose stage value matches no declared stage. */
  unassigned: SabcrmPipelineBoardStage;
  /** Total live records across all stages (including unassigned). */
  totalCount: number;
  /** Total amount across all stages (including unassigned). */
  totalAmount: number;
}

/** `POST /{id}/move-record` body sans `projectId`/pipeline `id`. */
export interface SabcrmPipelineMoveRecordInput {
  /** Hex `_id` of the record to move (in `sabcrm_records`). */
  recordId: string;
  /** Stage id to move the record into. Must match a declared stage. */
  stageId: string;
  /** `data.<field>` carrying the stage id. Defaults to `"stage"` server-side. */
  stageField?: string;
}

/** Raw `{ record }` envelope from `POST /{id}/move-record`. */
interface MoveRecordEnvelope {
  record: SabcrmRustRecord;
}

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const BASE = '/v1/sabcrm/pipelines';

export const sabcrmPipelinesApi = {
  /** `GET /v1/sabcrm/pipelines` — list the pipelines for one project. */
  async list(projectId: string): Promise<SabcrmRustPipeline[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.pipelines;
  },

  /** `GET /v1/sabcrm/pipelines/{id}` — fetch a single pipeline. */
  async get(projectId: string, id: string): Promise<SabcrmRustPipeline> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.pipeline;
  },

  /** `POST /v1/sabcrm/pipelines` — create a pipeline. */
  async create(
    projectId: string,
    input: SabcrmPipelineCreateInput,
  ): Promise<SabcrmRustPipeline> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.pipeline;
  },

  /** `PATCH /v1/sabcrm/pipelines/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmPipelineUpdateInput,
  ): Promise<SabcrmRustPipeline> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.pipeline;
  },

  /** `DELETE /v1/sabcrm/pipelines/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `GET /v1/sabcrm/pipelines/{id}/board` — the board view of one pipeline:
   * the pipeline document plus its ordered stages, each carrying a live
   * `count` and summed `amount`, an `unassigned` tail bucket and grand totals.
   */
  board(
    projectId: string,
    id: string,
    opts?: SabcrmPipelineBoardOpts,
  ): Promise<SabcrmPipelineBoardResponse> {
    return rustFetch<SabcrmPipelineBoardResponse>(
      `${BASE}/${encodeURIComponent(id)}/board${qs({
        projectId,
        stageField: opts?.stageField,
        amountField: opts?.amountField,
      })}`,
    );
  },

  /**
   * `POST /v1/sabcrm/pipelines/{id}/stages/reorder` — reorder a pipeline's
   * stages by id. `order` defines the new leading order; omitted stage ids
   * keep their relative order and are appended after. Returns the updated
   * pipeline.
   */
  async reorderStages(
    projectId: string,
    id: string,
    order: string[],
  ): Promise<SabcrmRustPipeline> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/stages/reorder`,
      { method: 'POST', body: JSON.stringify({ projectId, order }) },
    );
    return res.pipeline;
  },

  /**
   * `POST /v1/sabcrm/pipelines/{id}/move-record` — move one target-object
   * record into a stage of this pipeline by setting `data.<stageField>` to
   * the stage id. The stage id must match a declared stage. Returns the
   * updated record document.
   */
  async moveRecord(
    projectId: string,
    id: string,
    input: SabcrmPipelineMoveRecordInput,
  ): Promise<SabcrmRustRecord> {
    const res = await rustFetch<MoveRecordEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/move-record`,
      { method: 'POST', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.record;
  },
};
