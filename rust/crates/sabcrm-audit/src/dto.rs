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
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional object-slug filter.
    pub object: Option<String>,
    /// Optional record-id filter (paired with `object` in practice).
    pub record_id: Option<String>,
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
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub entries: Vec<Value>,
}

/// Response body for `POST /` — the appended audit entry.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EntryResponse {
    #[schema(value_type = Object)]
    pub entry: Value,
}
