//! Wire-format DTOs for the SabCRM activities-timeline HTTP surface.
//!
//! Mirrors the payloads accepted by `src/lib/sabcrm/activities.server.ts`
//! and the persisted `SabcrmActivityDoc` shape in `src/lib/sabcrm/db.ts`.
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params. `projectId` is required; `targetObject` +
/// `targetRecordId` narrow to a single record's timeline (omitted = whole
/// project feed); `type` is an optional filter; `limit` caps the page.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the record whose timeline to read (optional).
    #[serde(default)]
    pub target_object: Option<String>,
    /// Serialized id of the record whose timeline to read (optional).
    #[serde(default)]
    pub target_record_id: Option<String>,
    /// Optional `type` filter (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT).
    #[serde(default, rename = "type")]
    pub kind: Option<String>,
    /// Page size. Clamped at 200 by the handler. Defaults to 50.
    #[serde(default)]
    pub limit: Option<u64>,
}

/// A single SabFiles attachment ref carried by an activity. These are
/// references into the user's SabFiles library — **never** raw external
/// URLs. Mirrors `SabcrmActivityDoc.attachments` in `src/lib/sabcrm/db.ts`.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    /// SabFiles file id (the library reference).
    pub file_id: String,
    /// Display name of the file.
    pub name: String,
    /// MIME type (optional).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content_type: Option<String>,
    /// Byte size (optional).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub size: Option<u64>,
    /// Resolved download URL (optional; a SabFiles-served URL, never external).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

/// Query params for endpoints that only need the tenant scope
/// (`DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a timeline activity. The handler sets
/// `createdAt` / `updatedAt` server-side and assigns a fresh `_id`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateActivityInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Entry kind (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT).
    #[serde(rename = "type")]
    pub kind: String,
    /// Short title / subject line.
    pub title: String,
    /// Free-form body. Defaults to empty when absent.
    #[serde(default)]
    pub body: Option<String>,
    /// Object slug of the attached record.
    pub target_object: String,
    /// Serialized id of the attached record.
    pub target_record_id: String,
    /// Author user id.
    pub author_id: String,
    /// TASK-only workflow status (TODO | IN_PROGRESS | DONE).
    #[serde(default)]
    pub status: Option<String>,
    /// TASK-only assignee user id.
    #[serde(default)]
    pub assignee_id: Option<String>,
    /// TASK-only due date (RFC3339 string stored verbatim).
    #[serde(default)]
    pub due_at: Option<String>,
    /// SabFiles attachment refs (optional; omitted = none).
    #[serde(default)]
    pub attachments: Option<Vec<Attachment>>,
}

/// `PATCH /{id}` body — partial update (e.g. task status). Each key in the
/// flattened `patch` is `$set` verbatim; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateActivityInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — a timeline page of raw activity documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub activities: Vec<Value>,
}

/// Response body for `POST /` and `PATCH /{id}` — a single raw activity.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActivityResponse {
    #[schema(value_type = Object)]
    pub activity: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
