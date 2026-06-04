//! Wire-format DTOs for the SabCRM audit HTTP surface.
//!
//! An audit entry is a row in the `sabcrm_audit` collection:
//!
//! ```text
//! { _id, projectId, actorId, action, object?, recordId?,
//!   summary?, meta?: object, createdAt }
//! ```
//!
//! The `actorId` is always the caller (from `AuthUser`) and never arrives in
//! a request body. List responses return the stored document verbatim
//! (cleaned via `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list a project's audit entries, newest first.
///
/// Twenty-parity filtering: the append-only log can be narrowed by acting
/// `actorId`, `action`, target `object` + `recordId`, and a `[from, to]`
/// `createdAt` date range, then paginated. `createdAt` is stored as a
/// fixed-width RFC3339 UTC string, so the range bounds (`from` / `to`,
/// likewise RFC3339) compare correctly under a lexicographic `$gte` / `$lte`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional acting-user filter — matches the recorded `actorId`.
    pub actor_id: Option<String>,
    /// Optional action filter (`create` / `update` / `delete` / arbitrary).
    pub action: Option<String>,
    /// Optional object-slug filter.
    pub object: Option<String>,
    /// Optional record-id filter (paired with `object` in practice).
    pub record_id: Option<String>,
    /// Inclusive lower bound on `createdAt` (RFC3339). Entries before this
    /// instant are excluded.
    pub from: Option<String>,
    /// Inclusive upper bound on `createdAt` (RFC3339). Entries after this
    /// instant are excluded.
    pub to: Option<String>,
    /// 1-based page number for offset pagination. Defaults to 1.
    pub page: Option<u64>,
    /// Max entries to return. Default 100, capped at 500.
    pub limit: Option<i64>,
}

/// `POST /` body — append an audit entry stamped with the caller's `actorId`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AppendAuditInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The action recorded — `create` / `update` / `delete` / arbitrary.
    pub action: String,
    /// Object slug the action targeted, if any.
    pub object: Option<String>,
    /// Serialized id of the targeted record, if any.
    pub record_id: Option<String>,
    /// Optional human-readable one-line summary.
    pub summary: Option<String>,
    /// Optional structured metadata blob.
    #[schema(value_type = Object)]
    pub meta: Option<Value>,
}

/// Response body for `GET /` — the project's audit entries, newest first.
///
/// `entries` are the raw stored documents (cleaned, `_id` → `id`). The
/// pagination fields describe the slice: `total` is the count of entries
/// matching the filter (ignoring `page` / `limit`), and `page` / `limit`
/// echo the resolved (clamped) request values.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub entries: Vec<Value>,
    /// Total entries matching the filter across all pages.
    pub total: u64,
    /// Resolved 1-based page number for this response.
    pub page: u64,
    /// Resolved page size (after default + cap clamping).
    pub limit: u64,
}

/// A typed, fully-shaped audit event.
///
/// The list/append endpoints currently emit the stored document verbatim as
/// loose JSON (see [`ListResponse`] / [`EntryResponse`]). `AuditEvent` is the
/// canonical structured view of one `sabcrm_audit` row — Twenty's audit-event
/// shape (actor + action + object/record target + timestamp + structured
/// `meta`). It is additive and intended for typed consumers that prefer a
/// schema over `serde_json::Value`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AuditEvent {
    /// Hex id of the entry (the relabelled `_id`).
    pub id: String,
    /// Tenant scope.
    pub project_id: String,
    /// The acting user who performed the action.
    pub actor_id: String,
    /// The action recorded — `create` / `update` / `delete` / arbitrary.
    pub action: String,
    /// Object slug the action targeted, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object: Option<String>,
    /// Serialized id of the targeted record, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub record_id: Option<String>,
    /// Human-readable one-line summary, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    /// Structured metadata blob, if any.
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub meta: Option<Value>,
    /// Server-set RFC3339 creation timestamp.
    pub created_at: String,
}

/// Response body for `POST /` — the appended audit entry.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EntryResponse {
    #[schema(value_type = Object)]
    pub entry: Value,
}
