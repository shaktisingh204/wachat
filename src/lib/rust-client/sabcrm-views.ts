import 'server-only';

/**
 * SabCRM Views client — wraps the Rust `/v1/sabcrm/views` surface
 * (crate `sabcrm-views`, mounted by `sabnode-api`).
 *
 * A saved view is a per-object configuration (`name`, `kind`, `filters`,
 * `sortBy`, `sortDir`, `fields`, `groupByField`, `isDefault`). Tenant scope is
 * `projectId`; the Rust side requires a valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ views: [...] }` (list) and
 * `{ view: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-views/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';
import type { SabcrmRustRecord } from './sabcrm-records';

/** A SabCRM saved view as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustView {
  id: string;
  projectId: string;
  object: string;
  name: string;
  /** TABLE | BOARD | etc. */
  kind?: string;
  filters?: unknown;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  fields?: string[];
  groupByField?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /` body sans `projectId` — the flattened view document. Sent as
 * `{ projectId, ...input }`.
 */
export interface SabcrmViewCreateInput {
  object: string;
  name: string;
  kind?: string;
  filters?: unknown;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  fields?: string[];
  groupByField?: string;
  isDefault?: boolean;
}

/** `PATCH /{id}` body sans `projectId` — a partial view document. */
export interface SabcrmViewUpdateInput {
  [key: string]: unknown;
}

/** Raw `{ views }` envelope from `GET /`. */
interface ListEnvelope {
  views: SabcrmRustView[];
}

/** Raw `{ view }` envelope from `POST /`, `PATCH /{id}`, `POST /{id}/default`. */
interface SingleEnvelope {
  view: SabcrmRustView;
}

/** Pagination options accepted by `run`. */
export interface SabcrmViewRunOpts {
  /** 1-indexed page number. Defaults to 1 server-side. */
  page?: number;
  /** Page size. Clamped at 100 server-side; defaults to 50. */
  limit?: number;
}

/**
 * `{ records, total }` envelope from `POST /{id}/run` — a page of records
 * matching the view's filters/sort, in the records list wire shape.
 */
export interface SabcrmViewRunResponse {
  records: SabcrmRustRecord[];
  total: number;
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

const BASE = '/v1/sabcrm/views';

export const sabcrmViewsApi = {
  /** `GET /v1/sabcrm/views` — list the views for one object. */
  async list(projectId: string, object: string): Promise<SabcrmRustView[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, object })}`,
    );
    return res.views;
  },

  /** `POST /v1/sabcrm/views` — create a saved view. */
  async create(
    projectId: string,
    input: SabcrmViewCreateInput,
  ): Promise<SabcrmRustView> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.view;
  },

  /** `PATCH /v1/sabcrm/views/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmViewUpdateInput,
  ): Promise<SabcrmRustView> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.view;
  },

  /** `DELETE /v1/sabcrm/views/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /** `POST /v1/sabcrm/views/{id}/default` — make this view the object default. */
  async setDefault(projectId: string, id: string): Promise<SabcrmRustView> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}/default`,
      { method: 'POST', body: JSON.stringify({ projectId }) },
    );
    return res.view;
  },

  /**
   * `POST /v1/sabcrm/views/{id}/run` — apply the saved view's filters/sort to
   * the records collection server-side and return a page of records.
   */
  run(
    projectId: string,
    id: string,
    opts?: SabcrmViewRunOpts,
  ): Promise<SabcrmViewRunResponse> {
    return rustFetch<SabcrmViewRunResponse>(
      `${BASE}/${encodeURIComponent(id)}/run`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          page: opts?.page,
          limit: opts?.limit,
        }),
      },
    );
  },
};
