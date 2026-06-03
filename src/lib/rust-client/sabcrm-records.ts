import 'server-only';

/**
 * SabCRM Records client — wraps the Rust `/v1/sabcrm/records` surface
 * (crate `sabcrm-records`, mounted by `sabnode-api`).
 *
 * SabCRM is metadata-driven: every standard/custom object stores its records
 * in the single `sabcrm_records` Mongo collection as
 * `{ id, projectId, object, data: {…}, createdBy?, createdAt, updatedAt }`.
 * The `object` slug is part of the path; the `data` bag is free-form per the
 * object's field metadata (see `sabcrm-core` / `src/lib/sabcrm/schema.ts`).
 *
 * Tenant scope is `projectId` (the Next gate resolves it before calling here);
 * the Rust side additionally requires a valid `AuthUser` JWT, which
 * {@link rustFetch} mints from the session cookie.
 *
 * Wire shapes (camelCase) mirror the Rust handlers in
 * `rust/crates/sabcrm-records/src/{dto,handlers}.rs`.
 */
import { rustFetch } from './fetcher';

/** A SabCRM record as returned by the Rust engine (`_id` → `id` hex string). */
export interface SabcrmRustRecord {
  id: string;
  projectId: string;
  object: string;
  data: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SabcrmRecordListParams {
  projectId: string;
  /** Free-text query (regex over common data.* fields server-side). */
  q?: string;
  /** Field key to sort by; absent → top-level `updatedAt`. */
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  /**
   * Structured field filters, keyed by field key. Each condition is either a
   * bare scalar (equality on `data.<fieldKey>`) or an object
   * `{ op, value }` with `op` in `eq`|`ne`|`contains`|`gt`|`lt`|`gte`|`lte`|
   * `in`|`isEmpty`|`isNotEmpty`. JSON-stringified into the `filters` query
   * param; omitted when empty.
   */
  filters?: Record<string, unknown>;
}

export interface SabcrmRecordListResponse {
  records: SabcrmRustRecord[];
  total: number;
}

export interface SabcrmRecordGroup {
  value: string | null;
  records: SabcrmRustRecord[];
}

export interface SabcrmRecordGroupResponse {
  groups: SabcrmRecordGroup[];
}

/**
 * One relation block from the record-relations aggregate endpoint — the
 * related records reachable from a single RELATION field of the source object.
 */
export interface RecordRelation {
  /** Field key on the source object that defines this relation. */
  field: string;
  /** Human label of that field. */
  label: string;
  /** Slug of the related object. */
  targetObject: string;
  /** Cardinality from the source record's perspective. */
  kind: 'MANY_TO_ONE' | 'ONE_TO_MANY';
  /** The related records (capped at 50 server-side). */
  records: SabcrmRustRecord[];
}

export interface SabcrmRecordRelationsResponse {
  relations: RecordRelation[];
}

export interface SabcrmRecordCreateInput {
  projectId: string;
  data: Record<string, unknown>;
  createdBy?: string;
}

export interface SabcrmRecordUpdateInput {
  projectId: string;
  data: Record<string, unknown>;
}

export interface SabcrmRecordBulkDeleteResponse {
  ok: boolean;
  /** Number of records actually deleted. */
  deleted: number;
}

export interface SabcrmRecordBulkUpdateResponse {
  ok: boolean;
  /** Number of records actually modified. */
  updated: number;
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

const base = (object: string) =>
  `/v1/sabcrm/records/${encodeURIComponent(object)}`;

export const sabcrmRecordsApi = {
  /** `GET /v1/sabcrm/records/{object}` — paginated list. */
  list(
    object: string,
    params: SabcrmRecordListParams,
  ): Promise<SabcrmRecordListResponse> {
    const hasFilters =
      params.filters !== undefined &&
      Object.keys(params.filters).length > 0;
    return rustFetch<SabcrmRecordListResponse>(
      `${base(object)}${qs({
        projectId: params.projectId,
        q: params.q,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
        page: params.page,
        limit: params.limit,
        filters: hasFilters ? JSON.stringify(params.filters) : undefined,
      })}`,
    );
  },

  /** `GET /v1/sabcrm/records/{object}/{id}` — one record. */
  get(
    object: string,
    id: string,
    projectId: string,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<SabcrmRustRecord>(
      `${base(object)}/${encodeURIComponent(id)}${qs({ projectId })}`,
    );
  },

  /** `POST /v1/sabcrm/records/{object}` — create. */
  create(
    object: string,
    input: SabcrmRecordCreateInput,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<SabcrmRustRecord>(base(object), {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /** `PATCH /v1/sabcrm/records/{object}/{id}` — merge-update `data`. */
  update(
    object: string,
    id: string,
    input: SabcrmRecordUpdateInput,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<SabcrmRustRecord>(
      `${base(object)}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    );
  },

  /** `DELETE /v1/sabcrm/records/{object}/{id}`. */
  remove(
    object: string,
    id: string,
    projectId: string,
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${base(object)}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    );
  },

  /**
   * `GET /v1/sabcrm/records/{object}/{id}/related` — aggregate every related
   * record (across all of the object's RELATION fields) in one call.
   */
  relations(
    object: string,
    id: string,
    projectId: string,
  ): Promise<SabcrmRecordRelationsResponse> {
    return rustFetch<SabcrmRecordRelationsResponse>(
      `${base(object)}/${encodeURIComponent(id)}/related${qs({ projectId })}`,
    );
  },

  /**
   * `POST /v1/sabcrm/records/{object}/bulk-delete` — delete every record
   * whose id is in `ids` (scoped to `projectId` + object). Invalid ids are
   * skipped server-side; returns the count actually deleted.
   */
  bulkDelete(
    object: string,
    projectId: string,
    ids: string[],
  ): Promise<SabcrmRecordBulkDeleteResponse> {
    return rustFetch<SabcrmRecordBulkDeleteResponse>(
      `${base(object)}/bulk-delete`,
      { method: 'POST', body: JSON.stringify({ projectId, ids }) },
    );
  },

  /**
   * `POST /v1/sabcrm/records/{object}/bulk-update` — `$set` each `data.<k>`
   * (and bump `updatedAt`) on every record whose id is in `ids`. Invalid ids
   * are skipped server-side; returns the count actually modified.
   */
  bulkUpdate(
    object: string,
    projectId: string,
    ids: string[],
    data: Record<string, unknown>,
  ): Promise<SabcrmRecordBulkUpdateResponse> {
    return rustFetch<SabcrmRecordBulkUpdateResponse>(
      `${base(object)}/bulk-update`,
      { method: 'POST', body: JSON.stringify({ projectId, ids, data }) },
    );
  },

  /** `POST /v1/sabcrm/records/{object}/group` — kanban grouping. */
  group(
    object: string,
    projectId: string,
    groupByField: string,
  ): Promise<SabcrmRecordGroupResponse> {
    return rustFetch<SabcrmRecordGroupResponse>(`${base(object)}/group`, {
      method: 'POST',
      body: JSON.stringify({ projectId, groupByField }),
    });
  },
};
