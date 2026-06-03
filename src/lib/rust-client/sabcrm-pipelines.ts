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

/** A single stage within a pipeline. */
export interface SabcrmRustPipelineStage {
  id: string;
  label: string;
  color?: string;
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
};
