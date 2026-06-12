//! Wire-format DTOs for the SabCRM saved-views HTTP surface.
//!
//! Mirrors the payloads accepted by `src/lib/sabcrm/views.server.ts` and
//! the persisted `SabcrmViewDoc` shape in `src/lib/sabcrm/db.ts`. List /
//! single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the views for one object.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug whose views to list — required.
    pub object: String,
}

/// `POST /` body — create a saved view. `projectId` scopes the row; the
/// remaining keys form the view document (`object`, `name`, `kind`,
/// `filters`, `sortBy`, `sortDir`, `fields`, `groupByField`, `isDefault`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateViewInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are persisted as the view document.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub view: Value,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId`) is `$set` verbatim; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateViewInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Query params for endpoints that only need the tenant scope
/// (`DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /{id}/default` body — tenant scope only.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetDefaultInput {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /{id}/run` body — apply a saved view's filters/sort to the
/// `sabcrm_records` collection server-side and return a page of records.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunViewInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// 1-indexed page number. Defaults to 1 when absent or `<= 0`.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Clamped at 100 by the handler. Defaults to 50.
    #[serde(default)]
    pub limit: Option<u64>,
}

/// Response body for `GET /` — a list of raw view documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub views: Vec<Value>,
}

/// Response body for `POST /`, `PATCH /{id}` and `POST /{id}/default` — a
/// single raw view document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ViewResponse {
    #[schema(value_type = Object)]
    pub view: Value,
}

/// Response body for `POST /{id}/run` — a page of records matching the
/// view's filters/sort. Mirrors the records list wire shape
/// (`{ records, total }`, `_id` → `id`).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunViewResponse {
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
    pub total: u64,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

// ===========================================================================
// Twenty-parity view model (additive, fully optional)
// ===========================================================================
//
// The persisted view document is still stored / returned verbatim as a
// `serde_json::Value` (see [`CreateViewInput`] / [`UpdateViewInput`] above),
// which keeps the surface additive and lets the frontend view-bar round-trip
// any extra keys it writes. The structs below document and type the *canonical*
// Twenty-parity shape so generated OpenAPI clients and the view-bar agree on
// the field names / nesting:
//
// - [`ViewKind`]       — `table` (Twenty GRID) / `board` (KANBAN) / `calendar`.
// - [`ViewField`]      — per-view visible field with explicit order + width.
// - [`ViewFilter`]     — one `field`/`operator`/`value` leaf condition.
// - [`FilterOperator`] — Twenty's comparator set.
// - [`ViewFilterGroup`]— AND/OR nesting over leaves + child groups.
// - [`ViewSort`]       — one sort level (`field` + `direction`), multi-sort
//                        is an ordered `Vec<ViewSort>`.
// - [`SavedView`]      — the whole document, mirroring `SavedView` in
//                        `views.server.ts` / `SabcrmViewDoc` in `db.ts`.

/// Surface a saved view renders. Mirrors Twenty's `ViewType`
/// (`GRID` → `table`, `KANBAN` → `board`, plus `calendar`). Stored verbatim,
/// so unknown future kinds survive a round-trip via the raw `Value` payload.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ViewKind {
    /// Twenty `GRID` — a record table.
    Table,
    /// Twenty `KANBAN` — a board grouped into columns by [`SavedView::group_by_field`].
    Board,
    /// A calendar laid out over a date field.
    Calendar,
}

impl Default for ViewKind {
    fn default() -> Self {
        Self::Table
    }
}

/// One per-view visible field. The frontend view-bar uses `position` to order
/// columns (table) / card fields (board) and `is_visible` to toggle them; the
/// legacy `fields: string[]` ordering (see [`SavedView::fields`]) remains
/// supported for round-trip compatibility.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ViewField {
    /// Field key (matches a record's `data.<fieldKey>`).
    pub field_key: String,
    /// 0-based display order within the view.
    #[serde(default)]
    pub position: i32,
    /// Whether the field is shown. Defaults to `true`.
    #[serde(default = "default_true")]
    pub is_visible: bool,
    /// Optional column width in px (table views).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<i32>,
}

fn default_true() -> bool {
    true
}

/// Twenty's filter comparator set. Serialized lower-snake so it round-trips the
/// strings the view-bar persists. Unknown operators are tolerated by the run
/// handler (it falls back to equality) — the typed enum is for documentation
/// and the common cases.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum FilterOperator {
    Is,
    IsNot,
    Contains,
    DoesNotContain,
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    IsEmpty,
    IsNotEmpty,
    In,
    NotIn,
}

/// A single leaf filter condition: `field <operator> value`. `value` is an
/// arbitrary JSON scalar / array (e.g. the operand list for `in`). Belongs to
/// the filter group identified by `group_id` (root group when absent).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ViewFilter {
    /// Field key being filtered (matches `data.<fieldKey>`).
    pub field_key: String,
    /// Comparator. Defaults to [`FilterOperator::Is`].
    #[serde(default = "default_operator")]
    pub operator: FilterOperator,
    /// Operand. Omitted / null for `is_empty` / `is_not_empty`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub value: Option<Value>,
    /// Owning filter group id; `None` ⇒ the view's root group.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_id: Option<String>,
}

fn default_operator() -> FilterOperator {
    FilterOperator::Is
}

/// Logical operator combining the members of a [`ViewFilterGroup`].
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum LogicalOperator {
    And,
    Or,
}

impl Default for LogicalOperator {
    fn default() -> Self {
        Self::And
    }
}

/// A nestable AND/OR group of filters. Leaves reference a group through
/// [`ViewFilter::group_id`]; groups nest through `parent_group_id`. Mirrors
/// Twenty's `view-filter-group` module.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ViewFilterGroup {
    /// Stable id referenced by [`ViewFilter::group_id`] / child groups.
    pub id: String,
    /// How this group's members combine. Defaults to AND.
    #[serde(default)]
    pub logical_operator: LogicalOperator,
    /// Parent group id; `None` ⇒ this is the root group.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_group_id: Option<String>,
    /// Display order among sibling groups.
    #[serde(default)]
    pub position: i32,
}

/// Sort direction for one [`ViewSort`] level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum SortDirection {
    Asc,
    Desc,
}

impl Default for SortDirection {
    fn default() -> Self {
        Self::Desc
    }
}

/// One level of a multi-sort. The view's full sort is an ordered
/// `Vec<ViewSort>` (first entry is the primary key). Mirrors the single
/// `sortBy`/`sortDir` legacy pair, which remains supported.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ViewSort {
    /// Field key to sort on (matches `data.<fieldKey>`).
    pub field_key: String,
    /// Direction. Defaults to descending.
    #[serde(default)]
    pub direction: SortDirection,
    /// Order among sort levels (lower = applied first / primary).
    #[serde(default)]
    pub position: i32,
}

/// The canonical, Twenty-parity saved-view shape. This is the documented
/// contract the frontend view-bar round-trips. The HTTP handlers persist /
/// return the document as a raw `Value` (see [`ViewResponse`]), so every field
/// here is optional and additive — older documents that only carry the legacy
/// `filters` map / `sortBy`+`sortDir` pair / `fields: string[]` still
/// deserialize, and unknown keys survive.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SavedView {
    /// Hex `_id` of the persisted document.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Tenant scope.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    /// Owner of a private view; omitted for project-shared views.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    /// Object slug this view belongs to.
    pub object: String,
    /// Human label.
    pub name: String,
    /// Surface to render. Defaults to `table`.
    #[serde(default)]
    pub kind: ViewKind,

    /// Per-view visible fields with explicit order/width. When present this is
    /// authoritative over the legacy `fields` key.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub view_fields: Vec<ViewField>,
    /// Legacy ordered field keys (columns / card fields). Kept for round-trip.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fields: Option<Vec<String>>,

    /// AND/OR filter groups (nested via `parentGroupId`). The root group is the
    /// one with no `parentGroupId`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub filter_groups: Vec<ViewFilterGroup>,
    /// Structured leaf filters (`field`/`operator`/`value`, `groupId`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub view_filters: Vec<ViewFilter>,
    /// Legacy `fieldKey -> value` equality map. Still honored by `run_view`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub filters: Option<Value>,

    /// Multi-sort, ordered (primary first). Authoritative over the legacy pair.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub view_sorts: Vec<ViewSort>,
    /// Legacy single-sort field key.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_by: Option<String>,
    /// Legacy single-sort direction.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_dir: Option<SortDirection>,

    /// Board/calendar group-by field (SELECT field key). Mirrors Twenty's
    /// `view-group`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_by_field: Option<String>,

    /// Whether this is the object's default view.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_default: Option<bool>,

    /// RFC3339 timestamps (server-managed).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

// ===========================================================================
// Work-queue state (per-user, per-view) — `/{id}/queue`
// ===========================================================================
//
// A saved view becomes a prioritized work queue: the view's filters scope the
// queue, its multi-sort is the priority order, and each record gets per-user,
// non-destructive work state (Done / Snooze / Skip) persisted in the separate
// `sabcrm_view_queue_state` collection — one row per
// `(projectId, viewId, recordId, userId)`. The queue CONFIG (`queue` key on
// the view document: `enabled` / `doneWhen` / `slaField` / `snoozeMinutes`)
// rides the existing additive `#[serde(flatten)]` create/update path like
// `columnWidths` does, so no DTO change is needed for it.

/// `GET /{id}/queue` query params — list one user's queue state for a view.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QueueStateQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// The queue user whose state to list — required.
    pub user_id: String,
}

/// `POST /{id}/queue` body — mark one record's queue state for one user.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QueueMarkInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The queue user the state belongs to — required.
    pub user_id: String,
    /// The record being marked — required.
    pub record_id: String,
    /// "done" | "snooze" | "clear" (clear resets both flags).
    pub action: String,
    /// RFC3339 — required when action == "snooze".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub until: Option<String>,
}

/// Response body for `GET /{id}/queue` — the user's queue-state rows for the
/// view (cleaned docs, `_id` → `id`).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QueueStateResponse {
    #[schema(value_type = Vec<Object>)]
    pub states: Vec<Value>,
}

// ===========================================================================
// Serde tests — queue DTO wire shapes
// ===========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn queue_state_query_deserializes_camel_case() {
        let q: QueueStateQuery =
            serde_json::from_value(json!({ "projectId": "p1", "userId": "u1" }))
                .expect("camelCase keys deserialize");
        assert_eq!(q.project_id, "p1");
        assert_eq!(q.user_id, "u1");
    }

    #[test]
    fn queue_state_query_rejects_snake_case() {
        let res = serde_json::from_value::<QueueStateQuery>(
            json!({ "project_id": "p1", "user_id": "u1" }),
        );
        assert!(res.is_err(), "snake_case keys must not deserialize");
    }

    #[test]
    fn queue_mark_input_deserializes_snooze_with_until() {
        let m: QueueMarkInput = serde_json::from_value(json!({
            "projectId": "p1",
            "userId": "u1",
            "recordId": "r1",
            "action": "snooze",
            "until": "2026-06-13T09:00:00Z"
        }))
        .expect("full snooze body deserializes");
        assert_eq!(m.project_id, "p1");
        assert_eq!(m.user_id, "u1");
        assert_eq!(m.record_id, "r1");
        assert_eq!(m.action, "snooze");
        assert_eq!(m.until.as_deref(), Some("2026-06-13T09:00:00Z"));
    }

    #[test]
    fn queue_mark_input_until_defaults_to_none() {
        let m: QueueMarkInput = serde_json::from_value(json!({
            "projectId": "p1",
            "userId": "u1",
            "recordId": "r1",
            "action": "done"
        }))
        .expect("body without `until` deserializes");
        assert_eq!(m.action, "done");
        assert!(m.until.is_none());
    }

    #[test]
    fn queue_mark_input_requires_identity_keys() {
        let res = serde_json::from_value::<QueueMarkInput>(json!({
            "projectId": "p1",
            "action": "done"
        }));
        assert!(res.is_err(), "userId/recordId are required");
    }

    #[test]
    fn queue_state_response_serializes_states_array() {
        let res = QueueStateResponse {
            states: vec![json!({
                "id": "abc",
                "recordId": "r1",
                "userId": "u1",
                "snoozedUntil": null,
                "doneAt": "2026-06-12T10:00:00Z"
            })],
        };
        let v = serde_json::to_value(&res).expect("serializes");
        assert_eq!(v["states"][0]["recordId"], "r1");
        assert_eq!(v["states"][0]["doneAt"], "2026-06-12T10:00:00Z");
        assert!(v["states"][0]["snoozedUntil"].is_null());
    }
}
