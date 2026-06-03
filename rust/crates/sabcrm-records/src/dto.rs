//! Wire-format DTOs for the SabCRM generic records HTTP surface.
//!
//! These mirror the create / update / group payloads accepted by the
//! `src/lib/sabcrm/*.server.ts` record actions and the persisted
//! `SabcrmRecordDoc` shape in `src/lib/sabcrm/db.ts`:
//!
//! ```jsonc
//! {
//!   "_id": ObjectId,        // serialized as `id` (hex) on the wire
//!   "projectId": String,    // tenant scope
//!   "object": String,       // object slug (from the path)
//!   "data": Document,        // free-form field map
//!   "createdBy"?: String,
//!   "createdAt": String,     // RFC3339
//!   "updatedAt": String      // RFC3339
//! }
//! ```
//!
//! List/get responses are typed as `serde_json::Value` — `data` is
//! schemaless and follows the stored Mongo document verbatim (the same
//! `JSON.parse(JSON.stringify(...))` shape the TS code returns), produced
//! via `document_to_clean_json`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /{object}` query params. Tenancy is by `projectId` (required); the
/// handler also scopes by the `{object}` slug from the path. Page is
/// 1-indexed; the handler clamps `limit` at 100.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required. Records are filtered by `{ projectId, object }`.
    pub project_id: String,
    /// Optional free-text match over a few common `data.*` fields
    /// (case-insensitive regex).
    #[serde(default, alias = "query")]
    pub q: Option<String>,
    /// Field key to sort by — applied as `data.<sortBy>` when present,
    /// otherwise the top-level `updatedAt`.
    #[serde(default)]
    pub sort_by: Option<String>,
    /// Sort direction — `asc` | `desc`. Defaults to `desc`.
    #[serde(default)]
    pub sort_dir: Option<String>,
    /// 1-indexed page number. Defaults to 1 when absent or `<= 0`.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Clamped at 100 by the handler. Defaults to 20.
    #[serde(default)]
    pub limit: Option<u64>,
    /// Optional URL-encoded JSON string of structured field filters. Two
    /// shapes are accepted:
    ///
    /// - **flat map** — `{ "<fieldKey>": <condition>, ... }` where a condition
    ///   is either a bare scalar (string/number/bool → equality on
    ///   `data.<fieldKey>`) or an object `{ "op": "...", "value": <v> }`. All
    ///   entries are ANDed together.
    /// - **nested group** — `{ "op": "and" | "or", "conditions": [ ... ] }`
    ///   where each element of `conditions` is either a leaf
    ///   `{ "field": "<key>", "operator": "<op>", "value": <v> }` or another
    ///   nested group. Translated to Mongo `$and` / `$or` over `data.<field>`.
    ///
    /// `op` in `eq` | `ne` | `contains` | `gt` | `lt` | `gte` | `lte` | `in` |
    /// `isEmpty` | `isNotEmpty`. Bad JSON / shape is rejected with a `400`.
    #[serde(default)]
    pub filters: Option<String>,
}

/// `GET /{object}/count` query params. Carries the SAME tenant scope +
/// free-text `q` + structured `filters` as [`ListQuery`] (pagination / sort
/// are irrelevant to a count) so the count respects the active filter set.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CountQuery {
    /// Tenant scope — required. Records are filtered by `{ projectId, object }`.
    pub project_id: String,
    /// Optional free-text match over a few common `data.*` fields
    /// (case-insensitive regex). Mirrors [`ListQuery::q`].
    #[serde(default, alias = "query")]
    pub q: Option<String>,
    /// Optional URL-encoded JSON string of structured field filters, of the
    /// same shape accepted by [`ListQuery::filters`]. Bad JSON → `400`.
    #[serde(default)]
    pub filters: Option<String>,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{object}/{id}`, `DELETE /{object}/{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `GET /{object}/trash` query params — the tenant scope plus an optional page
/// size. Lists soft-deleted (trashed) records, newest-deleted first.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TrashQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Page size. Clamped at 100 by the handler. Defaults to 50.
    #[serde(default)]
    pub limit: Option<u64>,
}

/// Body for the trash / restore endpoints (`POST /{object}/{id}/trash`,
/// `POST /{object}/{id}/restore`) — tenant scope only.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TrashRestoreInput {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /{object}` body. The handler sets `createdAt` / `updatedAt`
/// server-side and assigns a fresh `_id`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Free-form field map keyed by the object's field keys.
    #[schema(value_type = Object)]
    pub data: Value,
    /// Optional creator user id.
    #[serde(default)]
    pub created_by: Option<String>,
}

/// `PATCH /{object}/{id}` body. Each key in `data` is `$set` as
/// `data.<key>`; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Partial field map — only the keys present are written.
    #[schema(value_type = Object)]
    pub data: Value,
}

/// `POST /{object}/group` body — groups records by `data.<groupByField>`
/// for the kanban board view.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupRecordsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Field key to group by (e.g. `stage`, `status`, `type`).
    pub group_by_field: String,
}

/// Response body for `GET /{object}` — a page of raw record documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
    pub total: u64,
}

/// Response body for `GET /{object}/count` — the number of records matching
/// the active `{ projectId, object }` + `q` + `filters` predicate.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CountResponse {
    pub count: u64,
}

/// Response body for `GET /{object}/{id}`, `POST /{object}` and
/// `PATCH /{object}/{id}` — a single raw record document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordResponse {
    #[schema(value_type = Object)]
    pub record: Value,
}

/// One kanban column in the `group_records` response.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordGroup {
    /// The distinct `data.<groupByField>` value for this column.
    #[schema(value_type = Object)]
    pub value: Value,
    /// Records in this column (capped per group).
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
}

/// Response body for `POST /{object}/group`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupResponse {
    pub groups: Vec<RecordGroup>,
}

/// `POST /{object}/aggregate` body — bucket records by `data.<groupByField>`
/// and reduce a `metric` over `data.<metricField>` (or a plain `count`). The
/// optional `filters` (same shape as [`ListQuery::filters`]) is ANDed into the
/// `{ projectId, object }` scope via `build_list_filter`. Caps at 200 buckets.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AggregateInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Field key to group by — bucketed on `data.<groupByField>`.
    pub group_by_field: String,
    /// Reduction applied to each bucket: `count` | `sum` | `avg` | `min` |
    /// `max`. `sum`/`avg`/`min`/`max` require `metricField`.
    pub metric: String,
    /// Field key the metric reduces over (`data.<metricField>`). Required for
    /// every metric except `count`.
    #[serde(default)]
    pub metric_field: Option<String>,
    /// Optional structured field filters, same shape as [`ListQuery::filters`].
    #[serde(default)]
    pub filters: Option<Value>,
}

/// One bucket in the [`AggregateResponse`].
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AggregateGroup {
    /// The distinct `data.<groupByField>` value for this bucket.
    #[schema(value_type = Object)]
    pub value: Value,
    /// The reduced metric for this bucket (a number).
    pub metric: f64,
}

/// Response body for `POST /{object}/aggregate`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AggregateResponse {
    pub groups: Vec<AggregateGroup>,
    /// The same metric reduced over ALL matched records (across buckets).
    pub total: f64,
}

/// `GET /{object}/distinct/{field}` query params — tenant scope only.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DistinctQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `GET /{object}/duplicates` query params — tenant scope plus the `field`
/// whose shared `data.<field>` value defines a duplicate group.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DuplicatesQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Field key whose duplicate `data.<field>` value groups records together.
    /// Empty / missing → `400`.
    pub field: String,
}

/// One group of records sharing the same `data.<field>` value in the
/// [`DuplicatesResponse`].
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    /// The shared `data.<field>` value (the duplicate key).
    #[schema(value_type = Object)]
    pub value: Value,
    /// Total number of records sharing this value (may exceed `records.len()`
    /// since the returned records are capped per group).
    pub count: u64,
    /// The actual records in this group (capped per group).
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
}

/// Response body for `GET /{object}/duplicates` — groups of records that share
/// the same non-null `data.<field>` value (capped at 100 groups).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DuplicatesResponse {
    pub groups: Vec<DuplicateGroup>,
}

/// Response body for `GET /{object}/distinct/{field}` — the distinct
/// `data.<field>` values (null/empty dropped, capped at 200).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DistinctResponse {
    #[schema(value_type = Vec<Object>)]
    pub values: Vec<Value>,
}

/// One relation block in the `record_relations` response — the related
/// records reachable from a single RELATION field of the source object.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordRelation {
    /// Field key on the source object that defines this relation.
    pub field: String,
    /// Human label of that field.
    pub label: String,
    /// Slug of the related object.
    pub target_object: String,
    /// Cardinality from the source record's perspective
    /// (`MANY_TO_ONE` | `ONE_TO_MANY`).
    pub kind: String,
    /// The related records (capped per relation).
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
}

/// Response body for `GET /{object}/{id}/related`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RelationsResponse {
    pub relations: Vec<RecordRelation>,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{object}/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

/// `GET /search` query params — a project-wide, cross-object free-text search.
/// Unlike the per-object endpoints there is no `{object}` path segment: the
/// query fans out over EVERY object in `projectId`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    /// Tenant scope — required. Records are filtered by `{ projectId }` only.
    pub project_id: String,
    /// Free-text query — case-insensitive regex over the common `data.*`
    /// text-ish fields. An empty / missing `q` yields no hits.
    #[serde(default, alias = "query")]
    pub q: Option<String>,
    /// Hard cap on hits returned. Clamped at 50 by the handler; defaults to 50.
    #[serde(default)]
    pub limit: Option<u64>,
}

/// One cross-object search hit in the [`SearchResponse`] — a single matched
/// record, identified by its object slug + id and labelled by its likely title
/// field, with an optional matched-text `snippet`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    /// Object slug the record belongs to (e.g. `people`, `companies`).
    pub object: String,
    /// Hex `ObjectId` of the matched record.
    pub id: String,
    /// Human label derived from the record's likely title field
    /// (name / title / firstName+lastName / email), falling back to the id.
    pub label: String,
    /// Optional matched-text snippet (the first text-ish field that matched `q`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,
}

/// Response body for `GET /search` — ranked cross-object record hits (capped
/// at 50).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub hits: Vec<SearchHit>,
}

/// `POST /{object}/bulk-delete` body. Deletes every record matching
/// `{ projectId, object, _id ∈ ids }`. Ids that aren't valid ObjectIds are
/// skipped (no error) rather than failing the whole batch.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Hex ObjectId strings of the records to delete. Invalid ids are skipped.
    pub ids: Vec<String>,
}

/// Response body for `POST /{object}/bulk-delete`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteResponse {
    pub ok: bool,
    /// Number of records actually deleted.
    pub deleted: u64,
}

/// `POST /{object}/bulk-update` body. `$set`s each `data.<k>` on every record
/// matching `{ projectId, object, _id ∈ ids }` and bumps `updatedAt`. Invalid
/// ids are skipped rather than failing the whole batch.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Hex ObjectId strings of the records to update. Invalid ids are skipped.
    pub ids: Vec<String>,
    /// Field map — each key is written as `data.<key>` on every matched record.
    #[schema(value_type = Object)]
    pub data: Value,
}

/// Response body for `POST /{object}/bulk-update`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateResponse {
    pub ok: bool,
    /// Number of records actually modified.
    pub updated: u64,
}

/// `POST /{object}/merge` body. Merges two records of the same object: the
/// surviving record is `primaryId`. The optional `data` map (the winning field
/// values chosen by the caller) is `$set` as `data.<k>` on the primary and
/// `updatedAt` is bumped; the `secondaryId` record is then deleted. Both ids
/// must resolve within `{ projectId, object }` or the call yields a `404`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MergeRecordsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Hex ObjectId of the surviving record.
    pub primary_id: String,
    /// Hex ObjectId of the record absorbed into (then deleted after) the merge.
    pub secondary_id: String,
    /// Optional winning field map — each key is written as `data.<key>` on the
    /// surviving primary record. Absent / empty → no field overrides, but
    /// `updatedAt` is still bumped and the secondary is still deleted.
    #[serde(default)]
    #[schema(value_type = Object)]
    pub data: Option<Value>,
}
