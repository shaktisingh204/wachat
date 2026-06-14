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

/**
 * A resolved relation / ACTOR hint emitted by the optional `?enrich=relations`
 * pass. Mirrors the Rust `RelationHint` DTO
 * (`rust/crates/sabcrm-records/src/dto.rs`) — a `{ id, label, avatarUrl? }`
 * triple resolving a stored id to a display label + optional avatar/logo URL.
 */
export interface SabcrmRelationHint {
  /** Hex ObjectId of the resolved related (or actor) record. */
  id: string;
  /** Human label resolved from the target object's label field. */
  label: string;
  /** Optional avatar / logo URL hint (omitted by the engine when none). */
  avatarUrl?: string;
}

/** A SabCRM record as returned by the Rust engine (`_id` → `id` hex string). */
export interface SabcrmRustRecord {
  id: string;
  projectId: string;
  object: string;
  data: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Resolved RELATION-field hints, present ONLY when the record was fetched
   * with relation enrichment ({@link SabcrmRecordListParams.enrich} /
   * {@link sabcrmRecordsApi.get}'s `enrich` flag). Maps each MANY_TO_ONE
   * RELATION field key → its resolved {@link SabcrmRelationHint}, or `null`
   * when the stored id is empty / dangling. Injected by the Rust handler as a
   * parallel top-level `__relations` map; absent on unenriched records.
   */
  __relations?: Record<string, SabcrmRelationHint | null>;
  /**
   * Resolved ACTOR hints, present ONLY under enrichment. Currently carries the
   * `createdBy` ACTOR resolved to a {@link SabcrmRelationHint}. Injected by the
   * Rust handler as a parallel top-level `__actors` map; absent on unenriched
   * records (or when the actor id did not resolve).
   */
  __actors?: { createdBy?: SabcrmRelationHint };
}

/** A single leaf condition inside a nested AND/OR filter group. */
export interface SabcrmFilterCondition {
  field: string;
  // Dialect now matches src/lib/sabcrm/records-filter.ts + sabcrm-segments:
  // `neq` (alias of `ne`), `notContains`, `notIn` are accepted by the engine;
  // `contains`/`notContains` operands are regex-escaped server-side.
  operator:
    | 'eq'
    | 'ne'
    | 'neq'
    | 'contains'
    | 'notContains'
    | 'gt'
    | 'lt'
    | 'gte'
    | 'lte'
    | 'in'
    | 'notIn'
    | 'isEmpty'
    | 'isNotEmpty';
  value?: unknown;
}

/**
 * A nested filter group — `{ op, conditions }` translated to Mongo
 * `$and` / `$or` over `data.<field>` server-side. Each element of
 * `conditions` is either a leaf {@link SabcrmFilterCondition} or another
 * nested group.
 */
export interface SabcrmFilterGroup {
  op: 'and' | 'or';
  conditions: Array<SabcrmFilterCondition | SabcrmFilterGroup>;
}

/**
 * The `filters` payload accepted by the engine. Two shapes are supported:
 *
 * - **flat map** — `{ "<fieldKey>": <condition> }`, ANDed together, where a
 *   condition is a bare scalar (equality) or `{ op, value }`.
 * - **nested group** — {@link SabcrmFilterGroup} (`{ op, conditions }`).
 */
export type SabcrmRecordFilters = Record<string, unknown> | SabcrmFilterGroup;

/**
 * A single **relation-join** filter — targets a *related* record's field rather
 * than this record's own `data.*`. The dotted `field` references a RELATION
 * field of the current object (`"<relationField>.<targetField>"`): the first
 * segment is the source RELATION fieldKey and the remainder is the target
 * object's `data.*` field. Satisfied server-side via an aggregation `$lookup`
 * on the relation's stored id into the target object's records, then a `$match`
 * on the joined `<targetField>`. Mirrors the **list** shape of the Rust
 * `ListQuery::relation_filters`.
 */
export interface SabcrmRelationFilterItem {
  /** Dotted `"<relationField>.<targetField>"` path. */
  field: string;
  /** Same operator dialect as {@link SabcrmFilterCondition.operator}. */
  op: SabcrmFilterCondition['operator'];
  value?: unknown;
}

/**
 * The `relationFilters` payload accepted by the engine. Two shapes are
 * supported (both ANDed into the base `{ projectId, object }` scope):
 *
 * - **flat map** — `{ "owner.name": <condition>, "company.industry": … }`,
 *   where the dotted key's first segment is the source RELATION fieldKey and the
 *   remainder is the target's `data.*` field. A condition is a bare scalar
 *   (equality) or `{ op, value }`.
 * - **list** — an array of {@link SabcrmRelationFilterItem}.
 *
 * When ANY relation filter is present the engine switches from the fast
 * `find()` path to an aggregation pipeline. Relations that can't be resolved
 * (unknown object/field, non-MANY_TO_ONE, custom object) are skipped gracefully
 * rather than erroring. Omitted / empty → the normal `find()` path, so existing
 * callers are unaffected. Mirrors the Rust `ListQuery::relation_filters`.
 */
export type SabcrmRecordRelationFilters =
  | Record<string, unknown>
  | SabcrmRelationFilterItem[];

/**
 * Cross-object global-search mode. `regex` (the default) runs the legacy
 * case-insensitive regex `$or` scan; `relevance` asks the engine to use a Mongo
 * `$text` search ranked by `{ score: textScore }` over the full-text index,
 * falling back to the regex scan when no text index is available. Mirrors the
 * Rust `SearchQuery::mode` (`text` / `score` are also accepted aliases of
 * `relevance` server-side). Omitted → `regex`.
 */
export type SabcrmSearchMode = 'regex' | 'relevance';

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
   * Structured field filters — either a flat field→condition map or a nested
   * AND/OR group ({@link SabcrmRecordFilters}). JSON-stringified into the
   * `filters` query param; omitted when empty.
   */
  filters?: SabcrmRecordFilters;
  /**
   * Relation / ACTOR enrichment toggle. When `true`, the `enrich=relations`
   * query param is sent and each returned record gains parallel top-level
   * {@link SabcrmRustRecord.__relations} + {@link SabcrmRustRecord.__actors}
   * maps resolving its MANY_TO_ONE RELATION fields + `createdBy` ACTOR to
   * `{ id, label, avatarUrl? }` hints. Omitted / `false` → raw ids only
   * (legacy shape), so existing callers are unaffected.
   */
  enrich?: boolean;
  /**
   * Relation-join filters — predicates over a *related* record's field (e.g.
   * `owner.name`, `company.industry`) rather than this record's own `data.*`.
   * JSON-stringified into the `relationFilters` query param; omitted when empty.
   * Presence flips the engine onto the aggregation (`$lookup` + `$match`) path.
   * See {@link SabcrmRecordRelationFilters}.
   */
  relationFilters?: SabcrmRecordRelationFilters;
  /**
   * Read-path access-enforcement clause — a serialized JSON Mongo clause from
   * `resolveAccessFilterParam` (`src/lib/sabcrm/access-readpath.server.ts`),
   * `$and`-merged server-side so the Rust read path enforces the SAME row scope
   * as the native-TS path (closes the two-store gotcha). DEFAULT-OFF: omit it
   * (the common case) and the query is byte-for-byte unchanged. Never built on
   * the client — always resolved server-side from the per-project flags.
   */
  accessFilter?: string;
}

export interface SabcrmRecordListResponse {
  records: SabcrmRustRecord[];
  total: number;
}

/**
 * Single-record wire envelope. Every single-record handler (`get`, `create`,
 * `update`, `trash`, `restore`, `merge`) wraps its result in `{ record }`
 * (Rust `RecordResponse`); the client methods unwrap it before returning so
 * callers receive a bare {@link SabcrmRustRecord}.
 */
interface RecordEnvelope {
  record: SabcrmRustRecord;
}

/** Params accepted by {@link sabcrmRecordsApi.count} — scope + filter only. */
export interface SabcrmRecordCountParams {
  projectId: string;
  /** Free-text query (regex over common data.* fields server-side). */
  q?: string;
  /** Structured field filters; see {@link SabcrmRecordListParams.filters}. */
  filters?: SabcrmRecordFilters;
  /** Read-path access clause; see {@link SabcrmRecordListParams.accessFilter}. */
  accessFilter?: string;
}

export interface SabcrmRecordCountResponse {
  count: number;
}

export interface SabcrmRecordGroup {
  // The Rust group_records handler emits `value` as arbitrary JSON (a kanban
  // groupBy field can be numeric/boolean, not just a string), so widen to
  // `unknown` to match the engine (cf. AggregateGroup.value / DistinctResponse).
  value: unknown;
  /**
   * Total number of records in this column (the true count — may exceed
   * `records.length` since returned records are capped per column, and is the
   * only signal when `countOnly` was requested).
   */
  count: number;
  /**
   * Sum of `data.<sumField>` across every record in this column when a
   * `sumField` was requested; `null`/absent otherwise. Non-numeric values
   * contribute `0`. Drives the kanban column footer.
   */
  sum?: number | null;
  /** Records in this column (capped per group). Empty when `countOnly` was set. */
  records: SabcrmRustRecord[];
}

export interface SabcrmRecordGroupResponse {
  groups: SabcrmRecordGroup[];
}

/** Options for {@link sabcrmRecordsApi.group} — the new kanban depth knobs. */
export interface SabcrmRecordGroupOpts {
  /**
   * Field key (`data.<sumField>`) summed per column to drive the kanban column
   * footer (e.g. total `amount` per opportunity stage). When present every
   * returned {@link SabcrmRecordGroup} carries a numeric `sum`.
   */
  sumField?: string;
  /**
   * When `true`, columns report their `count` (and optional `sum`) but omit the
   * per-column `records` array — a lightweight board-header pass.
   */
  countOnly?: boolean;
  /**
   * Relation/actor enrichment toggle, same semantics as
   * {@link SabcrmRecordListParams.enrich}. When `true` the per-column `records`
   * gain the parallel `__relations` / `__actors` hint maps. Ignored when
   * `countOnly` is set (no records to enrich).
   */
  enrich?: boolean;
  /** Structured field filters ANDed into the scope before grouping. */
  filters?: SabcrmRecordFilters;
  /** Read-path access clause; see {@link SabcrmRecordListParams.accessFilter}. */
  accessFilter?: string;
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

/** Reduction applied by {@link sabcrmRecordsApi.aggregate}. */
export type SabcrmAggregateMetric = 'count' | 'sum' | 'avg' | 'min' | 'max';

/**
 * One named metric in a multi-metric aggregation request. Mirrors Twenty's
 * per-field aggregate operations where a single groupBy pass reports several
 * reduced values side-by-side. Mirrors the Rust `AggregateMetricSpec`.
 */
export interface SabcrmAggregateMetricSpec {
  /**
   * Output key this metric is reported under in each bucket's `metrics` map and
   * in `totals` (e.g. `dealCount`, `totalAmount`). Required + non-empty.
   */
  key: string;
  /** Reduction op. Everything except `count` requires a `field`. */
  op: SabcrmAggregateMetric;
  /** Field key the op reduces over (`data.<field>`). Required except for `count`. */
  field?: string;
}

/**
 * Params accepted by {@link sabcrmRecordsApi.aggregate}. Two request forms are
 * supported (both honoured in one pass): a **single metric** (`metric` +
 * `metricField`) and a **multi-metric** list (`metrics`).
 */
export interface SabcrmRecordAggregateParams {
  projectId: string;
  /** Field key bucketed on `data.<groupByField>`. */
  groupByField: string;
  /**
   * Single-metric reduction. `sum`/`avg`/`min`/`max` require `metricField`.
   * Optional when `metrics` is supplied; defaults to `count` only when neither
   * is given.
   */
  metric?: SabcrmAggregateMetric;
  /** Field key the single `metric` reduces over (`data.<metricField>`). */
  metricField?: string;
  /**
   * Optional list of named per-field metrics computed in the same pass — the
   * group-by + count + sum/avg/min/max-per-field surface.
   */
  metrics?: SabcrmAggregateMetricSpec[];
  /** Structured field filters; see {@link SabcrmRecordListParams.filters}. */
  filters?: SabcrmRecordFilters;
  /** Read-path access clause; see {@link SabcrmRecordListParams.accessFilter}. */
  accessFilter?: string;
}

/** One bucket from the aggregate endpoint. */
export interface SabcrmRecordAggregateGroup {
  /** Distinct `data.<groupByField>` value for this bucket. */
  value: unknown;
  /**
   * Reduced single `metric` for this bucket. When only the multi-metric form
   * was requested this defaults to the bucket's count.
   */
  metric: number;
  /**
   * Per-named-metric reduced values for this bucket, keyed by each
   * {@link SabcrmAggregateMetricSpec.key}. Present only when `metrics` was
   * requested.
   */
  metrics?: Record<string, number>;
}

export interface SabcrmRecordAggregateResponse {
  groups: SabcrmRecordAggregateGroup[];
  /** Same single `metric` reduced over ALL matched records. */
  total: number;
  /**
   * Per-named-metric values reduced over ALL matched records. Present only when
   * `metrics` was requested; keyed like each bucket's `metrics` map.
   */
  totals?: Record<string, number>;
}

export interface SabcrmRecordDistinctResponse {
  /** Distinct `data.<field>` values (null/empty dropped, capped at 200). */
  values: unknown[];
}

/** One group of records sharing the same `data.<field>` value. */
export interface SabcrmRecordDuplicateGroup {
  /** The shared `data.<field>` value (the duplicate key). */
  value: unknown;
  /** Total records sharing this value (may exceed `records.length`). */
  count: number;
  /** The actual records in this group (capped at 10 server-side). */
  records: SabcrmRustRecord[];
}

export interface SabcrmRecordDuplicatesResponse {
  /** Groups of records sharing a duplicate value (capped at 100 groups). */
  groups: SabcrmRecordDuplicateGroup[];
}

/**
 * One cross-object global-search hit — a single matched record identified by
 * its object slug + id, labelled by its likely title field, with an optional
 * matched-text snippet. Mirrors the Rust `SearchHit` DTO.
 */
export interface SabcrmSearchHit {
  /** Object slug the record belongs to (e.g. `people`, `companies`). */
  object: string;
  /** Hex id of the matched record. */
  id: string;
  /** Human label derived from name/title/firstName+lastName/email. */
  label: string;
  /** Optional matched-text snippet (the first text-ish field that matched). */
  snippet?: string;
}

export interface SabcrmSearchResponse {
  hits: SabcrmSearchHit[];
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

/** Body for {@link sabcrmRecordsApi.merge}. */
export interface SabcrmRecordMergeInput {
  projectId: string;
  /** Hex id of the surviving record. */
  primaryId: string;
  /** Hex id of the record absorbed into (then deleted after) the merge. */
  secondaryId: string;
  /** Optional winning field values `$set` on the primary record. */
  data?: Record<string, unknown>;
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
  /**
   * `GET /v1/sabcrm/records/search` — **cross-object** global search. Matches
   * `q` (case-insensitive) against the common text-ish `data.*` fields of
   * EVERY object in `projectId` (trashed records excluded) and returns ranked
   * record hits (`{ object, id, label, snippet? }`), capped at 50 server-side.
   * An empty `q` yields no hits.
   *
   * `mode` selects the match strategy (see {@link SabcrmSearchMode}): the
   * default `regex` runs the legacy case-insensitive scan; `relevance` uses a
   * Mongo `$text` search ranked by text score (falling back to regex when no
   * full-text index is available). Omitted → `regex`, so existing callers are
   * unaffected.
   */
  searchAll(
    projectId: string,
    q: string,
    limit?: number,
    mode?: SabcrmSearchMode,
  ): Promise<SabcrmSearchResponse> {
    return rustFetch<SabcrmSearchResponse>(
      `/v1/sabcrm/records/search${qs({ projectId, q, limit, mode })}`,
    );
  },

  /** `GET /v1/sabcrm/records/{object}` — paginated list. */
  list(
    object: string,
    params: SabcrmRecordListParams,
  ): Promise<SabcrmRecordListResponse> {
    const hasFilters =
      params.filters !== undefined &&
      Object.keys(params.filters).length > 0;
    const rf = params.relationFilters;
    const hasRelationFilters =
      rf !== undefined &&
      (Array.isArray(rf) ? rf.length > 0 : Object.keys(rf).length > 0);
    return rustFetch<SabcrmRecordListResponse>(
      `${base(object)}${qs({
        projectId: params.projectId,
        q: params.q,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
        page: params.page,
        limit: params.limit,
        filters: hasFilters ? JSON.stringify(params.filters) : undefined,
        relationFilters: hasRelationFilters ? JSON.stringify(rf) : undefined,
        enrich: params.enrich ? 'relations' : undefined,
        accessFilter: params.accessFilter || undefined,
      })}`,
    );
  },

  /**
   * `GET /v1/sabcrm/records/{object}/count` — number of records matching the
   * SAME `{ projectId, object }` + `q` + `filters` predicate as {@link list}
   * (pagination/sort are irrelevant to a count).
   */
  count(
    object: string,
    params: SabcrmRecordCountParams,
  ): Promise<SabcrmRecordCountResponse> {
    const hasFilters =
      params.filters !== undefined &&
      Object.keys(params.filters).length > 0;
    return rustFetch<SabcrmRecordCountResponse>(
      `${base(object)}/count${qs({
        projectId: params.projectId,
        q: params.q,
        filters: hasFilters ? JSON.stringify(params.filters) : undefined,
        accessFilter: params.accessFilter || undefined,
      })}`,
    );
  },

  /**
   * `GET /v1/sabcrm/records/{object}/{id}` — one record. When `enrich` is
   * `true`, the `enrich=relations` query param is sent and the returned record
   * carries the parallel {@link SabcrmRustRecord.__relations} +
   * {@link SabcrmRustRecord.__actors} hint maps (same semantics as
   * {@link SabcrmRecordListParams.enrich}); omitted → raw ids only.
   */
  get(
    object: string,
    id: string,
    projectId: string,
    enrich?: boolean,
    accessFilter?: string,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<RecordEnvelope>(
      `${base(object)}/${encodeURIComponent(id)}${qs({
        projectId,
        enrich: enrich ? 'relations' : undefined,
        accessFilter: accessFilter || undefined,
      })}`,
    ).then((res) => res.record);
  },

  /** `POST /v1/sabcrm/records/{object}` — create. */
  create(
    object: string,
    input: SabcrmRecordCreateInput,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<RecordEnvelope>(base(object), {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((res) => res.record);
  },

  /** `PATCH /v1/sabcrm/records/{object}/{id}` — merge-update `data`. */
  update(
    object: string,
    id: string,
    input: SabcrmRecordUpdateInput,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<RecordEnvelope>(
      `${base(object)}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ).then((res) => res.record);
  },

  /**
   * `DELETE /v1/sabcrm/records/{object}/{id}` — **soft delete** (trash). Sets
   * the record's top-level `deletedAt` so it is hidden from normal views but
   * recoverable via {@link restore}; use {@link permanentDelete} to hard-delete.
   */
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
   * `POST /v1/sabcrm/records/{object}/{id}/trash` — soft-delete a record by
   * setting its `deletedAt` (server-set). Returns the now-trashed record.
   */
  trash(
    object: string,
    id: string,
    projectId: string,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<RecordEnvelope>(
      `${base(object)}/${encodeURIComponent(id)}/trash`,
      { method: 'POST', body: JSON.stringify({ projectId }) },
    ).then((res) => res.record);
  },

  /**
   * `GET /v1/sabcrm/records/{object}/trash` — list the soft-deleted (trashed)
   * records for `projectId` + object, newest-deleted first. `limit` defaults
   * to 50, clamped at 100 server-side.
   */
  listTrash(
    object: string,
    projectId: string,
    limit?: number,
  ): Promise<SabcrmRecordListResponse> {
    return rustFetch<SabcrmRecordListResponse>(
      `${base(object)}/trash${qs({ projectId, limit })}`,
    );
  },

  /**
   * `POST /v1/sabcrm/records/{object}/{id}/restore` — un-trash a record by
   * unsetting its `deletedAt`. Returns the restored record.
   */
  restore(
    object: string,
    id: string,
    projectId: string,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<RecordEnvelope>(
      `${base(object)}/${encodeURIComponent(id)}/restore`,
      { method: 'POST', body: JSON.stringify({ projectId }) },
    ).then((res) => res.record);
  },

  /**
   * `DELETE /v1/sabcrm/records/{object}/{id}/permanent` — **hard delete** a
   * record (live or trashed). Irreversible.
   */
  permanentDelete(
    object: string,
    id: string,
    projectId: string,
  ): Promise<{ ok: boolean }> {
    return rustFetch<{ ok: boolean }>(
      `${base(object)}/${encodeURIComponent(id)}/permanent${qs({ projectId })}`,
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

  /**
   * `POST /v1/sabcrm/records/{object}/merge` — merge two records of the same
   * object into the surviving `primaryId`. The optional `data` map (winning
   * field values) is `$set` on the primary, the secondary's activities are
   * re-pointed onto the primary, then the secondary is deleted. Returns the
   * merged primary record.
   */
  merge(
    object: string,
    input: SabcrmRecordMergeInput,
  ): Promise<SabcrmRustRecord> {
    return rustFetch<RecordEnvelope>(`${base(object)}/merge`, {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((res) => res.record);
  },

  /**
   * `POST /v1/sabcrm/records/{object}/aggregate` — bucket records by
   * `data.<groupByField>` and reduce a `metric` (count|sum|avg|min|max) over
   * `data.<metricField>`. Returns per-bucket metrics plus an overall `total`.
   * Buckets are capped at 200 server-side.
   */
  aggregate(
    object: string,
    params: SabcrmRecordAggregateParams,
  ): Promise<SabcrmRecordAggregateResponse> {
    const hasFilters =
      params.filters !== undefined &&
      Object.keys(params.filters).length > 0;
    return rustFetch<SabcrmRecordAggregateResponse>(
      `${base(object)}/aggregate`,
      {
        method: 'POST',
        body: JSON.stringify({
          projectId: params.projectId,
          groupByField: params.groupByField,
          metric: params.metric,
          metricField: params.metricField,
          metrics: params.metrics,
          filters: hasFilters ? params.filters : undefined,
          accessFilter: params.accessFilter || undefined,
        }),
      },
    );
  },

  /**
   * `GET /v1/sabcrm/records/{object}/distinct/{field}` — the distinct
   * `data.<field>` values within `projectId` + object. Null/empty values are
   * dropped server-side and the list is capped at 200.
   */
  distinct(
    object: string,
    field: string,
    projectId: string,
  ): Promise<SabcrmRecordDistinctResponse> {
    return rustFetch<SabcrmRecordDistinctResponse>(
      `${base(object)}/distinct/${encodeURIComponent(field)}${qs({ projectId })}`,
    );
  },

  /**
   * `GET /v1/sabcrm/records/{object}/duplicates?field=<field>` — find groups
   * of records that share the same non-null `data.<field>` value (the
   * duplicate key) within `projectId` + object. Groups are capped at 100 and
   * each group's `records` at 10 server-side (`count` reflects the true
   * total). An empty `field` is rejected server-side with a 400.
   */
  duplicates(
    object: string,
    field: string,
    projectId: string,
  ): Promise<SabcrmRecordDuplicatesResponse> {
    return rustFetch<SabcrmRecordDuplicatesResponse>(
      `${base(object)}/duplicates${qs({ projectId, field })}`,
    );
  },

  /**
   * `POST /v1/sabcrm/records/{object}/group` — kanban grouping. Each returned
   * column carries a true `count`, an optional per-column `sum` (when `sumField`
   * is given), and its `records` (omitted when `countOnly` is set). Optional
   * `enrich` adds the `__relations` / `__actors` hint maps to the column records;
   * optional `filters` are ANDed into the scope before grouping.
   */
  group(
    object: string,
    projectId: string,
    groupByField: string,
    opts?: SabcrmRecordGroupOpts,
  ): Promise<SabcrmRecordGroupResponse> {
    const hasFilters =
      opts?.filters !== undefined &&
      Object.keys(opts.filters).length > 0;
    return rustFetch<SabcrmRecordGroupResponse>(`${base(object)}/group`, {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        groupByField,
        sumField: opts?.sumField,
        countOnly: opts?.countOnly,
        enrich: opts?.enrich ? 'relations' : undefined,
        filters: hasFilters ? opts!.filters : undefined,
        accessFilter: opts?.accessFilter || undefined,
      }),
    });
  },
};
