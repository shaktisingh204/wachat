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

/**
 * Events a workflow trigger can listen on. The three `record.*` events mirror
 * the original engine contract; `manual` / `cron` / `webhook` extend it toward
 * Twenty's full trigger catalogue. Unknown event slugs round-trip verbatim
 * (the Rust side maps them to a forward-compatible `Other`).
 */
export type SabcrmWorkflowEvent =
  | 'record.created'
  | 'record.updated'
  | 'record.deleted'
  /**
   * The record's pipeline-stage field changed (legacy CRM `stage_changed`).
   * Watched field defaults to `data.stage`; the trigger may carry `field`,
   * `fromValue` and `toValue` extras to narrow the match.
   */
  | 'record.stage_changed'
  /**
   * The record's `status` field changed (legacy CRM `status_changed`).
   * Same mechanics as `record.stage_changed` but defaulting to `data.status`.
   */
  | 'record.status_changed'
  /**
   * Time-based trigger (legacy CRM `time_elapsed`). Definition-only here —
   * evaluated by the scheduler tick (`src/lib/sabcrm/scheduler.ts`). Trigger
   * extras: `afterMinutes` / `afterHours` / `afterDays` (+ optional
   * `sinceField`, default `updatedAt`).
   */
  | 'time.elapsed'
  | 'manual'
  | 'cron'
  | 'webhook'
  | (string & {});

/**
 * The kinds of action a workflow step can perform. Covers the eight step
 * types the AutomationBuilder authors; unknown kinds round-trip verbatim.
 */
export type SabcrmWorkflowStepType =
  | 'create_task'
  | 'send_notification'
  | 'update_field'
  | 'webhook'
  | 'filter'
  | 'if_else'
  | 'find_records'
  | 'upsert_record'
  /**
   * Send a WhatsApp template message through WaChat (legacy CRM
   * `send_whatsapp_template`). Config: `{ templateId, to, variables?, mediaId? }`
   * — executed via the existing `/v1/wachat/templates/{id}/send` surface.
   */
  | 'send_whatsapp_template'
  | (string & {});

/** Lifecycle status of a workflow version. */
export type SabcrmWorkflowVersionStatus =
  | 'draft'
  | 'active'
  | 'deactivated'
  | 'archived'
  | (string & {});

/**
 * A workflow trigger: the firing event coupled to the target object slug.
 * `object` is optional so object-agnostic triggers (`manual` / `cron` /
 * `webhook`) round-trip without a synthetic value. Forward-compatible trigger
 * settings (cron expression, webhook secret, field filters, …) are carried as
 * extra top-level keys, hence the index signature.
 */
export interface SabcrmWorkflowTrigger {
  event: SabcrmWorkflowEvent;
  /** Target object slug. Absent for object-agnostic triggers. */
  object?: string;
  [key: string]: unknown;
}

/**
 * One step in a workflow's pipeline. `config` is step-type specific. `enabled`
 * lets a single step be muted without removing it (defaults to `true`).
 * Forward-compatible per-step metadata (name, position, branch hints) round-
 * trips through extra top-level keys, hence the index signature.
 */
export interface SabcrmWorkflowStep {
  id: string;
  type: SabcrmWorkflowStepType;
  config: Record<string, unknown>;
  /** Whether this step runs. Defaults to `true` server-side when omitted. */
  enabled?: boolean;
  [key: string]: unknown;
}

/**
 * An immutable snapshot of a workflow's `{ trigger, steps }` at a given
 * revision. Each run is pinned to a version so edits are non-destructive and
 * runs reproducible. `trigger` / `steps` are carried verbatim.
 */
export interface SabcrmWorkflowVersion {
  /** Monotonic version number, starting at 1. */
  version: number;
  /** Lifecycle status — `draft` / `active` / `deactivated` / `archived`. */
  status: SabcrmWorkflowVersionStatus;
  trigger: SabcrmWorkflowTrigger;
  steps: SabcrmWorkflowStep[];
  /** RFC3339 creation timestamp. */
  createdAt?: string;
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

  // --- Versioning depth (additive) ---
  /** The currently-active version number (monotonic, starts at 1). */
  currentVersion?: number;
  /** Immutable snapshots of each revision's `{ trigger, steps }`. */
  versions?: SabcrmWorkflowVersion[];

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
  /**
   * Optional explicit starting version number. Defaults to `1` server-side.
   * Lets a caller seed a workflow at a known revision (e.g. on import).
   */
  currentVersion?: number;
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
