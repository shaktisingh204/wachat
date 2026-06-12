import 'server-only';

/**
 * SabCRM Approvals client — wraps the Rust `/v1/sabcrm/approvals` surface
 * (crate `sabcrm-approvals`, mounted by `sabnode-api`).
 *
 * An approval request is raised when a record tries to enter a pipeline stage
 * declared with `requiresApproval: true` (a stage **entry gate** — see
 * `sabcrm-pipelines`' `StageGovernance` and the
 * `src/app/actions/sabcrm-stage-gates.actions.ts` server actions). A request
 * is `pending` until a decider approves or rejects it; deciding is one-shot.
 *
 * Tenant scope is `projectId`; the Rust side requires a valid `AuthUser` JWT
 * and records the caller as `requestedBy` / `decidedBy`. Wire shapes mirror
 * `rust/crates/sabcrm-approvals/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** Lifecycle status of an approval request. */
export type SabcrmApprovalStatus = 'pending' | 'approved' | 'rejected';

/** A stage-gate approval request as returned by the Rust engine. */
export interface SabcrmRustApproval {
  id: string;
  projectId: string;
  /** Funnel object slug the record belongs to (e.g. `"leads"`). */
  objectSlug: string;
  /** Hex `_id` of the record awaiting the move (in `sabcrm_records`). */
  recordId: string;
  /** Pipeline the target stage belongs to (hex id). */
  pipelineId: string;
  /** Stage the record currently sits in, if known at request time. */
  fromStageId?: string;
  /** Stage the record wants to ENTER (the gated stage). */
  toStageId: string;
  /** User id of the requester (from the JWT, never client-supplied). */
  requestedBy: string;
  /** Requester's free-text justification, if any. */
  reason?: string;
  status: SabcrmApprovalStatus;
  /** User id of the decider (set on approve/reject). */
  decidedBy?: string;
  /** RFC3339 decision timestamp (set on approve/reject). */
  decidedAt?: string;
  /** Decider's optional note (set on approve/reject; null when omitted). */
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Filters + pagination for {@link sabcrmApprovalsApi.list}. */
export interface SabcrmApprovalListParams {
  status?: SabcrmApprovalStatus;
  objectSlug?: string;
  recordId?: string;
  pipelineId?: string;
  toStageId?: string;
  /** 1-based page number. Defaults to 1 server-side. */
  page?: number;
  /** Page size. Defaults to 50, capped at 200 server-side. */
  limit?: number;
}

/** `GET /` response — one page of requests plus the pagination envelope. */
export interface SabcrmApprovalListResponse {
  approvals: SabcrmRustApproval[];
  /** Total requests matching the filter across all pages. */
  total: number;
  /** Resolved 1-based page number. */
  page: number;
  /** Resolved page size (after default + cap clamping). */
  limit: number;
}

/** `POST /` body sans `projectId` — raise an approval request. */
export interface SabcrmApprovalCreateInput {
  objectSlug: string;
  recordId: string;
  pipelineId: string;
  fromStageId?: string;
  toStageId: string;
  reason?: string;
}

/**
 * `POST /`, `POST /{id}/approve`, `POST /{id}/reject` envelope. `created` is
 * `false` only when `POST /` found an identical pending request and returned
 * it instead of inserting a duplicate.
 */
export interface SabcrmApprovalEnvelope {
  approval: SabcrmRustApproval;
  created: boolean;
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

const BASE = '/v1/sabcrm/approvals';

export const sabcrmApprovalsApi = {
  /**
   * `GET /v1/sabcrm/approvals` — list approval requests for one project,
   * newest first, optionally narrowed by status / object / record /
   * pipeline / target stage, paginated.
   */
  list(
    projectId: string,
    params?: SabcrmApprovalListParams,
  ): Promise<SabcrmApprovalListResponse> {
    return rustFetch<SabcrmApprovalListResponse>(
      `${BASE}${qs({
        projectId,
        status: params?.status,
        objectSlug: params?.objectSlug,
        recordId: params?.recordId,
        pipelineId: params?.pipelineId,
        toStageId: params?.toStageId,
        page: params?.page,
        limit: params?.limit,
      })}`,
    );
  },

  /**
   * `POST /v1/sabcrm/approvals` — raise a pending approval request.
   * Idempotent on the live gate: an identical pending request (same record →
   * same target stage) is returned with `created: false` instead of
   * duplicating.
   */
  create(
    projectId: string,
    input: SabcrmApprovalCreateInput,
  ): Promise<SabcrmApprovalEnvelope> {
    return rustFetch<SabcrmApprovalEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
  },

  /**
   * `POST /v1/sabcrm/approvals/{id}/approve` — approve a pending request
   * (one-shot; 404 when the request is missing or already decided).
   */
  async approve(
    projectId: string,
    id: string,
    note?: string,
  ): Promise<SabcrmRustApproval> {
    const res = await rustFetch<SabcrmApprovalEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/approve`,
      { method: 'POST', body: JSON.stringify({ projectId, note }) },
    );
    return res.approval;
  },

  /**
   * `POST /v1/sabcrm/approvals/{id}/reject` — reject a pending request
   * (one-shot; 404 when the request is missing or already decided).
   */
  async reject(
    projectId: string,
    id: string,
    note?: string,
  ): Promise<SabcrmRustApproval> {
    const res = await rustFetch<SabcrmApprovalEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/reject`,
      { method: 'POST', body: JSON.stringify({ projectId, note }) },
    );
    return res.approval;
  },
};
