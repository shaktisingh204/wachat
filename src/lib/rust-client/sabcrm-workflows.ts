import 'server-only';

/**
 * SabCRM Workflows client — wraps the Rust `/v1/sabcrm/workflows` surface
 * (crate `sabcrm-workflows`, mounted by `sabnode-api`).
 *
 * A workflow is a per-project automation rule: a record-lifecycle `trigger`
 * (`record.created` | `record.updated` | `record.deleted`, on one `object`)
 * driving an ordered list of `steps` (`create_task` | `send_notification` |
 * `update_field` | `webhook`). `enabled` toggles whether it fires. Tenant
 * scope is `projectId`; the Rust side requires a valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ workflows: [...] }` (list) and
 * `{ workflow: {...} }` (single); this client unwraps them. Wire shapes
 * mirror `rust/crates/sabcrm-workflows/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** Record-lifecycle events a workflow trigger can listen on. */
export type SabcrmWorkflowEvent =
  | 'record.created'
  | 'record.updated'
  | 'record.deleted';

/** The kinds of action a workflow step can perform. */
export type SabcrmWorkflowStepType =
  | 'create_task'
  | 'send_notification'
  | 'update_field'
  | 'webhook';

/** A record-lifecycle trigger: which event, on which object. */
export interface SabcrmWorkflowTrigger {
  event: SabcrmWorkflowEvent;
  object: string;
}

/** One step in a workflow's pipeline. `config` is step-type specific. */
export interface SabcrmWorkflowStep {
  id: string;
  type: SabcrmWorkflowStepType;
  config: Record<string, unknown>;
}

/** A SabCRM workflow as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustWorkflow {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: SabcrmWorkflowTrigger;
  steps: SabcrmWorkflowStep[];
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
}

/**
 * `POST /` body sans `projectId`. Sent as `{ projectId, ...input }`. `steps`
 * defaults to `[]` and `enabled` to `false` server-side when omitted.
 */
export interface SabcrmWorkflowCreateInput {
  name: string;
  description?: string;
  trigger: SabcrmWorkflowTrigger;
  steps?: SabcrmWorkflowStep[];
  enabled?: boolean;
}

/**
 * `PATCH /{id}` body sans `projectId` — a partial workflow document. Covers
 * enable/disable, trigger swaps and step edits.
 */
export interface SabcrmWorkflowUpdateInput {
  name?: string;
  description?: string;
  enabled?: boolean;
  trigger?: SabcrmWorkflowTrigger;
  steps?: SabcrmWorkflowStep[];
  [key: string]: unknown;
}

/** Raw `{ workflows }` envelope from `GET /`. */
interface ListEnvelope {
  workflows: SabcrmRustWorkflow[];
}

/** Raw `{ workflow }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SingleEnvelope {
  workflow: SabcrmRustWorkflow;
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

const BASE = '/v1/sabcrm/workflows';

export const sabcrmWorkflowsApi = {
  /** `GET /v1/sabcrm/workflows` — list the workflows for one project. */
  async list(projectId: string): Promise<SabcrmRustWorkflow[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.workflows;
  },

  /** `GET /v1/sabcrm/workflows/{id}` — fetch one workflow (404 → throws). */
  async get(projectId: string, id: string): Promise<SabcrmRustWorkflow> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.workflow;
  },

  /** `POST /v1/sabcrm/workflows` — create a workflow. */
  async create(
    projectId: string,
    input: SabcrmWorkflowCreateInput,
  ): Promise<SabcrmRustWorkflow> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.workflow;
  },

  /** `PATCH /v1/sabcrm/workflows/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmWorkflowUpdateInput,
  ): Promise<SabcrmRustWorkflow> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.workflow;
  },

  /** `DELETE /v1/sabcrm/workflows/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
