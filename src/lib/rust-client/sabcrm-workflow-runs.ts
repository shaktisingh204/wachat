import 'server-only';

/**
 * SabCRM Workflow-Runs client — wraps the Rust `/v1/sabcrm/workflow-runs`
 * surface (crate `sabcrm-workflow-runs`, mounted by `sabnode-api`).
 *
 * A workflow run is a durable record of ONE execution of a workflow:
 * `status` (`running` | `success` | `failed`), the `trigger` that started
 * it, `startedAt` / `finishedAt` timing, and an ordered `steps` array
 * (`{ id, type, status, output?, error? }`) capturing per-step progress.
 *
 * Tenant scope is `projectId`; the Rust side requires a valid `AuthUser`
 * JWT. The Rust handlers wrap responses in `{ runs: [...] }` (list) and
 * `{ run: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-workflow-runs/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/**
 * Lifecycle status of a workflow RUN. The Rust side validates + canonicalizes
 * a supplied status into this vocabulary; a transition to a terminal status
 * (`success` / `failed` / `stopped`) auto-stamps `finishedAt`.
 */
export type SabcrmWorkflowRunStatus =
  | 'running'
  | 'success'
  | 'failed'
  | 'stopped'
  | 'not_started'
  | (string & {});

/**
 * Lifecycle status of a single STEP inside a run. Same vocabulary as the run
 * status, plus `pending` (queued but not yet started).
 */
export type SabcrmWorkflowRunStepStatus =
  | SabcrmWorkflowRunStatus
  | 'pending'
  | (string & {});

/** One step inside a workflow run. */
export interface SabcrmRustWorkflowRunStep {
  id: string;
  type: string;
  status: SabcrmWorkflowRunStepStatus;
  output?: unknown;
  error?: string;
}

/** A SabCRM workflow run as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustWorkflowRun {
  id: string;
  projectId: string;
  workflowId: string;
  status: SabcrmWorkflowRunStatus;
  trigger?: unknown;
  startedAt: string;
  finishedAt?: string;
  steps: SabcrmRustWorkflowRunStep[];
  createdAt: string;
  updatedAt?: string;
}

/**
 * `POST /` body sans `projectId` — the flattened run document. Sent as
 * `{ projectId, ...input }`. `status` defaults to `running` server-side.
 */
export interface SabcrmWorkflowRunCreateInput {
  workflowId: string;
  trigger?: unknown;
  status?: SabcrmWorkflowRunStatus;
  steps?: SabcrmRustWorkflowRunStep[];
}

/** `PATCH /{id}` body sans `projectId` — a partial run document. */
export interface SabcrmWorkflowRunUpdateInput {
  status?: SabcrmWorkflowRunStatus;
  steps?: SabcrmRustWorkflowRunStep[];
  finishedAt?: string;
  [key: string]: unknown;
}

/** Pagination/filter options accepted by `list`. */
export interface SabcrmWorkflowRunListOpts {
  /** Restrict to a single workflow's runs. */
  workflowId?: string;
  /** Max number of runs to return. Clamped at 200 server-side; defaults to 50. */
  limit?: number;
}

/** Raw `{ runs }` envelope from `GET /`. */
interface ListEnvelope {
  runs: SabcrmRustWorkflowRun[];
}

/** Raw `{ run }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SingleEnvelope {
  run: SabcrmRustWorkflowRun;
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

const BASE = '/v1/sabcrm/workflow-runs';

export const sabcrmWorkflowRunsApi = {
  /**
   * `GET /v1/sabcrm/workflow-runs` — list runs (newest first), optionally
   * filtered to one workflow and capped by `limit`.
   */
  async list(
    projectId: string,
    opts?: SabcrmWorkflowRunListOpts,
  ): Promise<SabcrmRustWorkflowRun[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({
        projectId,
        workflowId: opts?.workflowId,
        limit: opts?.limit,
      })}`,
    );
    return res.runs;
  },

  /** `GET /v1/sabcrm/workflow-runs/{id}` — fetch one run by id. */
  async get(projectId: string, id: string): Promise<SabcrmRustWorkflowRun> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.run;
  },

  /** `POST /v1/sabcrm/workflow-runs` — create a workflow run. */
  async create(
    projectId: string,
    input: SabcrmWorkflowRunCreateInput,
  ): Promise<SabcrmRustWorkflowRun> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.run;
  },

  /** `PATCH /v1/sabcrm/workflow-runs/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmWorkflowRunUpdateInput,
  ): Promise<SabcrmRustWorkflowRun> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.run;
  },
};
