//! Wire-format DTOs for the SabCRM targets HTTP surface.
//!
//! A target row is the polymorphic junction
//! `(sourceObject, sourceId) → (targetObject, targetId)` within a
//! `projectId`. List responses return the stored document verbatim
//! (cleaned via `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — targets attached to a single source activity
/// (what records this note / task / activity points at).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListForSourceQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Source activity kind (`notes` | `tasks` | `activities`).
    pub source_object: String,
    /// Serialized id of the source activity.
    pub source_id: String,
}

/// `GET /for-record` query params — sources attached to a single record
/// (notes / tasks / activities on this company, person, …).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListForRecordQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the linked record (e.g. `companies`, `people`).
    pub target_object: String,
    /// Serialized id of the linked record.
    pub target_id: String,
}

/// `POST /` body — link a source activity to a record (idempotent upsert).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LinkTargetInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Source activity kind (`notes` | `tasks` | `activities`).
    pub source_object: String,
    /// Serialized id of the source activity.
    pub source_id: String,
    /// Object slug of the linked record.
    pub target_object: String,
    /// Serialized id of the linked record.
    pub target_id: String,
}

/// `DELETE /` query params — unlink a source activity from a record.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkTargetQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Source activity kind (`notes` | `tasks` | `activities`).
    pub source_object: String,
    /// Serialized id of the source activity.
    pub source_id: String,
    /// Object slug of the linked record.
    pub target_object: String,
    /// Serialized id of the linked record.
    pub target_id: String,
}

/// Response body for the two `GET` directions — the matched target rows,
/// newest first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub targets: Vec<Value>,
}

/// Response body for `POST /` — the upserted target row.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TargetResponse {
    #[schema(value_type = Object)]
    pub target: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
