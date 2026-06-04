import 'server-only';

/**
 * SabCRM Segments client — wraps the Rust `/v1/sabcrm/segments` surface
 * (crate `sabcrm-segments`, mounted by `sabnode-api`).
 *
 * A saved segment (smart list) is a named object + filter definition,
 * optionally with a `sortBy` / `sortDir` and a `color`. Tenant scope is
 * `projectId`; the Rust side requires a valid `AuthUser` JWT.
 *
 * The Rust handlers wrap responses in `{ segments: [...] }` (list) and
 * `{ segment: {...} }` (single); this client unwraps them. Wire shapes mirror
 * `rust/crates/sabcrm-segments/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM saved segment as returned by the Rust engine (`_id` → `id` hex). */
export interface SabcrmRustSegment {
  id: string;
  projectId: string;
  name: string;
  object: string;
  filters?: unknown;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  color?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /` body sans `projectId` — the flattened segment document. Sent as
 * `{ projectId, ...input }`.
 */
export interface SabcrmSegmentCreateInput {
  name: string;
  object: string;
  filters?: unknown;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  color?: string;
}

/** `PATCH /{id}` body sans `projectId` — a partial segment document. */
export interface SabcrmSegmentUpdateInput {
  [key: string]: unknown;
}

/**
 * Body for {@link sabcrmSegmentsApi.apply} sans `id` — apply a stored
 * segment's records-filter AST to `sabcrm_records` server-side and return a
 * page of records. Mirrors the Rust `ApplySegmentInput`.
 */
export interface SabcrmSegmentApplyInput {
  /** 1-indexed page number. Defaults to 1 server-side. */
  page?: number;
  /** Page size. Clamped at 100 server-side; defaults to 50. */
  limit?: number;
  /**
   * Optional adhoc records-filter AST ANDed on top of the segment's stored
   * filter without mutating it (a leaf `{ field, op, value? }`, a group
   * `{ op: 'and' | 'or', conditions: [...] }`, or an array of nodes). Absent /
   * `null` → the segment's stored filter is used verbatim.
   */
  filter?: unknown;
  /**
   * Optional sort-field override (`data.<sortBy>`, or the `createdAt` /
   * `updatedAt` audit column). Falls back to the segment's stored `sortBy`.
   */
  sortBy?: string;
  /**
   * Optional sort direction override. Falls back to the segment's stored
   * `sortDir`, then `desc`.
   */
  sortDir?: 'asc' | 'desc';
}

/**
 * Response from {@link sabcrmSegmentsApi.apply} — a page of records matching
 * the segment's filter AST. Mirrors the records list wire shape
 * (`{ records, total }`, `_id` → `id`). Records are raw stored documents.
 */
export interface SabcrmSegmentApplyResult {
  records: Array<Record<string, unknown>>;
  total: number;
}

/** Raw `{ segments }` envelope from `GET /`. */
interface ListEnvelope {
  segments: SabcrmRustSegment[];
}

/** Raw `{ segment }` envelope from `GET /{id}`, `POST /`, `PATCH /{id}`. */
interface SingleEnvelope {
  segment: SabcrmRustSegment;
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

const BASE = '/v1/sabcrm/segments';

export const sabcrmSegmentsApi = {
  /** `GET /v1/sabcrm/segments` — list segments, optionally narrowed by object. */
  async list(
    projectId: string,
    object?: string,
  ): Promise<SabcrmRustSegment[]> {
    const res = await rustFetch<ListEnvelope>(
      `${BASE}${qs({ projectId, object })}`,
    );
    return res.segments;
  },

  /** `GET /v1/sabcrm/segments/{id}` — fetch one segment by id. */
  async get(projectId: string, id: string): Promise<SabcrmRustSegment> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
    return res.segment;
  },

  /** `POST /v1/sabcrm/segments` — create a saved segment. */
  async create(
    projectId: string,
    input: SabcrmSegmentCreateInput,
  ): Promise<SabcrmRustSegment> {
    const res = await rustFetch<SingleEnvelope>(BASE, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...input }),
    });
    return res.segment;
  },

  /** `PATCH /v1/sabcrm/segments/{id}` — partial update. */
  async update(
    projectId: string,
    id: string,
    input: SabcrmSegmentUpdateInput,
  ): Promise<SabcrmRustSegment> {
    const res = await rustFetch<SingleEnvelope>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ projectId, ...input }) },
    );
    return res.segment;
  },

  /**
   * `POST /v1/sabcrm/segments/{id}/apply` — apply the stored segment's
   * records-filter AST against `sabcrm_records` (scoped to its `object`) and
   * return a page of records. An optional adhoc `filter` is ANDed on top
   * without mutating the saved segment. Returns `{ records, total }`.
   */
  apply(
    projectId: string,
    id: string,
    input?: SabcrmSegmentApplyInput,
  ): Promise<SabcrmSegmentApplyResult> {
    return rustFetch<SabcrmSegmentApplyResult>(
      `${BASE}/${encodeURIComponent(id)}/apply`,
      { method: 'POST', body: JSON.stringify({ projectId, ...input }) },
    );
  },

  /** `DELETE /v1/sabcrm/segments/{id}` — scoped delete. */
  remove(projectId: string, id: string): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },
};
