import 'server-only';

/**
 * SabCRM Dashboards client — wraps the Rust `/v1/sabcrm/dashboards` surface
 * (crate `sabcrm-dashboards`, mounted by `sabnode-api`).
 *
 * A saved dashboard is a per-project layout: a `name` plus an ordered list of
 * `widgets`, each `{ id, type, title, config }`. Tenant scope is `projectId`;
 * the Rust side requires a valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ dashboards: [...] }` (list) and
 * `{ dashboard: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-dashboards/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A single widget on a dashboard. `config` is an opaque per-type blob. */
export interface SabcrmRustWidget {
  id: string;
  type: string;
  title: string;
  config?: unknown;
}

/** A SabCRM saved dashboard as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustDashboard {
  id: string;
  projectId: string;
  name: string;
  widgets: SabcrmRustWidget[];
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /` body sans `projectId`. Sent as `{ projectId, ...input }`. `widgets`
 * defaults to `[]` server-side when omitted.
 */
export interface SabcrmDashboardCreateInput {
  name: string;
  widgets?: SabcrmRustWidget[];
}

/** `PATCH /{id}` body sans `projectId` — a partial dashboard document. */
export interface SabcrmDashboardUpdateInput {
  name?: string;
  widgets?: SabcrmRustWidget[];
  [key: string]: unknown;
}

/** Raw `{ dashboards }` envelope from `GET /`. */
interface ListEnvelope {
  dashboards: SabcrmRustDashboard[];
}

/** Raw `{ dashboard }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SingleEnvelope {
  dashboard: SabcrmRustDashboard;
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

const BASE = '/v1/sabcrm/dashboards';

export const sabcrmDashboardsApi = {
  /** `GET /v1/sabcrm/dashboards` — list the dashboards for one project. */
  async list(projectId: string): Promise<SabcrmRustDashboard[]> {
    const res = await rustFetch<ListEnvelope>(`${BASE}${qs({ projectId })}`);
    return res.dashboards;
  },

  /** `GET /v1/sabcrm/dashboards/{id}` — fetch a single dashboard. */
  async get(projectId: string, id: string): Promise<SabcrmRustDashboard> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.dashboard;
  },

  /** `POST /v1/sabcrm/dashboards` — create a saved dashboard. */
  async create(
    projectId: string,
    input: SabcrmDashboardCreateInput,
  ): Promise<SabcrmRustDashboard> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.dashboard;
  },

  /** `PATCH /v1/sabcrm/dashboards/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmDashboardUpdateInput,
  ): Promise<SabcrmRustDashboard> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.dashboard;
  },

  /** `DELETE /v1/sabcrm/dashboards/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
