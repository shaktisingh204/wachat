import 'server-only';

/**
 * SabCRM Targets client — wraps the Rust `/v1/sabcrm/targets` surface
 * (crate `sabcrm-targets`, mounted by `sabnode-api`).
 *
 * Targets are polymorphic junctions linking ONE source activity (a note /
 * task / activity) to MANY records of ANY object — Twenty's `task-target` /
 * `note-target` morph pattern. Each row is
 * `(sourceObject, sourceId) → (targetObject, targetId)`. Tenant scope is
 * `projectId`. The two list directions answer:
 *
 *   - `listForSource` — what records a note / task points at; and
 *   - `listForRecord` — what notes / tasks are attached to a record.
 *
 * The Rust handlers wrap responses in `{ targets: [...] }` (list) and
 * `{ target: {...} }` (single); this client unwraps them. Wire shapes
 * mirror `rust/crates/sabcrm-targets/src/{dto,handlers}.rs`.
 *
 * The same Rust router additionally mounts the ADDITIVE **sales quotas**
 * sub-resource (`/quotas`) — per-project goals/targets powering the
 * `/sabcrm/forecast` attainment UI — exposed here as
 * {@link sabcrmQuotasApi} (separate `sabcrm_sales_targets` collection).
 */
import { rustFetch } from './fetcher';

/** A SabCRM target row as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustTarget {
  id: string;
  projectId: string;
  /** Source activity kind (`notes` | `tasks` | `activities`). */
  sourceObject: string;
  sourceId: string;
  /** Object slug of the linked record (e.g. `companies`, `people`). */
  targetObject: string;
  targetId: string;
  createdAt: string;
}

/** Raw `{ targets }` envelope from the `GET` directions. */
interface ListEnvelope {
  targets: SabcrmRustTarget[];
}

/** Raw `{ target }` envelope from `POST /`. */
interface SingleEnvelope {
  target: SabcrmRustTarget;
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

const BASE = '/v1/sabcrm/targets';

export const sabcrmTargetsApi = {
  /**
   * `GET /v1/sabcrm/targets` — the records a single note / task / activity
   * is attached to, newest first.
   */
  async listForSource(
    projectId: string,
    sourceObject: string,
    sourceId: string,
  ): Promise<SabcrmRustTarget[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, sourceObject, sourceId })}`,
    );
    return res.targets;
  },

  /**
   * `GET /v1/sabcrm/targets/for-record` — the notes / tasks / activities
   * attached to a single record, newest first.
   */
  async listForRecord(
    projectId: string,
    targetObject: string,
    targetId: string,
  ): Promise<SabcrmRustTarget[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}/for-record${qs({ projectId, targetObject, targetId })}`,
    );
    return res.targets;
  },

  /** `POST /v1/sabcrm/targets` — link a source to a record (idempotent). */
  async link(
    projectId: string,
    sourceObject: string,
    sourceId: string,
    targetObject: string,
    targetId: string,
  ): Promise<SabcrmRustTarget> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        sourceObject,
        sourceId,
        targetObject,
        targetId,
      }),
    });
    return res.target;
  },

  /** `DELETE /v1/sabcrm/targets` — unlink a source from a record (idempotent). */
  unlink(
    projectId: string,
    sourceObject: string,
    sourceId: string,
    targetObject: string,
    targetId: string,
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}${qs({ projectId, sourceObject, sourceId, targetObject, targetId })}`,
      { method: 'DELETE' },
    );
  },
};

// ---------------------------------------------------------------------------
// Sales quotas (`/quotas`) — goals & targets for the weighted forecast
// ---------------------------------------------------------------------------

/** Quota period kind. */
export type SabcrmQuotaPeriod = 'month' | 'quarter';

/** What a quota measures: currency revenue or closed-deal count. */
export type SabcrmQuotaMetric = 'revenue' | 'count';

/**
 * A sales quota row as returned by the Rust engine (`_id` → `id` hex).
 * Stored in `sabcrm_sales_targets`; `memberId` absent → whole-team quota,
 * `pipelineId` absent → all pipelines.
 */
export interface SabcrmRustQuota {
  id: string;
  projectId: string;
  name: string;
  period: SabcrmQuotaPeriod;
  /** First day of the period, `YYYY-MM-DD`. */
  periodStart: string;
  metric: SabcrmQuotaMetric;
  amount: number;
  /** Owning member (hex user id). Absent → whole-team quota. */
  memberId?: string;
  /** Scoping pipeline (hex id). Absent → all pipelines. */
  pipelineId?: string;
  createdAt: string;
  updatedAt: string;
}

/** `POST /quotas` body sans `projectId`. */
export interface SabcrmQuotaCreateInput {
  name: string;
  period: SabcrmQuotaPeriod;
  /** First day of the period, `YYYY-MM-DD`. */
  periodStart: string;
  metric: SabcrmQuotaMetric;
  amount: number;
  /** Omit for a whole-team quota. */
  memberId?: string;
  /** Omit for all pipelines. */
  pipelineId?: string;
}

/**
 * `PATCH /quotas/{id}` body sans `projectId` — only present keys are `$set`.
 * Send an explicit empty string for `memberId` / `pipelineId` to clear the
 * scope back to team-wide / all-pipelines.
 */
export interface SabcrmQuotaUpdateInput {
  name?: string;
  period?: SabcrmQuotaPeriod;
  periodStart?: string;
  metric?: SabcrmQuotaMetric;
  amount?: number;
  memberId?: string;
  pipelineId?: string;
}

/** Optional narrowing filters for {@link sabcrmQuotasApi.list}. */
export interface SabcrmQuotaListOpts {
  period?: SabcrmQuotaPeriod;
  periodStart?: string;
  pipelineId?: string;
}

/** Raw `{ quotas }` envelope from `GET /quotas`. */
interface QuotaListEnvelope {
  quotas: SabcrmRustQuota[];
}

/** Raw `{ quota }` envelope from `POST /quotas` / `PATCH /quotas/{id}`. */
interface QuotaSingleEnvelope {
  quota: SabcrmRustQuota;
}

export const sabcrmQuotasApi = {
  /**
   * `GET /v1/sabcrm/targets/quotas` — list a project's sales quotas,
   * newest `periodStart` first.
   */
  async list(
    projectId: string,
    opts?: SabcrmQuotaListOpts,
  ): Promise<SabcrmRustQuota[]> {
    const res = await rustFetch<QuotaListEnvelope>(
      `${BASE}/quotas${qs({
        projectId,
        period: opts?.period,
        periodStart: opts?.periodStart,
        pipelineId: opts?.pipelineId,
      })}`,
    );
    return res.quotas;
  },

  /** `POST /v1/sabcrm/targets/quotas` — create a sales quota. */
  async create(
    projectId: string,
    input: SabcrmQuotaCreateInput,
  ): Promise<SabcrmRustQuota> {
    const res = await rustFetch<QuotaSingleEnvelope>(`${BASE}/quotas`, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.quota;
  },

  /** `PATCH /v1/sabcrm/targets/quotas/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmQuotaUpdateInput,
  ): Promise<SabcrmRustQuota> {
    const res = await rustFetch<QuotaSingleEnvelope>(
      `${BASE}/quotas/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.quota;
  },

  /** `DELETE /v1/sabcrm/targets/quotas/{id}` — scoped delete (idempotent). */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/quotas/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
