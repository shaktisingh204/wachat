//! Wire-format DTOs for the SabCRM stage-approvals HTTP surface.
//!
//! Mirrors the persisted `sabcrm_approvals` document shape:
//!
//! ```text
//! { _id, projectId, objectSlug, recordId, pipelineId,
//!   fromStageId?, toStageId, requestedBy, reason?,
//!   status: "pending" | "approved" | "rejected",
//!   decidedBy?, decidedAt?, note?, createdAt, updatedAt }
//! ```
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`), matching the sibling `sabcrm-pipelines`
//! wire convention.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list approval requests for one project, optionally
/// narrowed by status / record / pipeline, paginated.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Narrow to one lifecycle status (`pending` / `approved` / `rejected`).
    #[serde(default)]
    pub status: Option<String>,
    /// Narrow to one funnel object slug (e.g. `"leads"`).
    #[serde(default)]
    pub object_slug: Option<String>,
    /// Narrow to one record (hex id, as stored).
    #[serde(default)]
    pub record_id: Option<String>,
    /// Narrow to one pipeline (hex id, as stored).
    #[serde(default)]
    pub pipeline_id: Option<String>,
    /// Narrow to one target stage id.
    #[serde(default)]
    pub to_stage_id: Option<String>,
    /// 1-based page number for offset pagination. Defaults to 1.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Defaults to 50, capped at 200.
    #[serde(default)]
    pub limit: Option<i64>,
}

/// `POST /` body — raise an approval request for a stage move.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateApprovalInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Funnel object slug the record belongs to (e.g. `"leads"`).
    pub object_slug: String,
    /// Hex `_id` of the record awaiting the move (in `sabcrm_records`).
    pub record_id: String,
    /// Pipeline the target stage belongs to (hex id).
    pub pipeline_id: String,
    /// Stage the record currently sits in, if known.
    #[serde(default)]
    pub from_stage_id: Option<String>,
    /// Stage the record wants to ENTER (the gated stage).
    pub to_stage_id: String,
    /// Requester's free-text justification.
    #[serde(default)]
    pub reason: Option<String>,
}

/// `POST /{id}/approve` / `POST /{id}/reject` body — decide a pending
/// request, with an optional decider note.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DecideInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional decider note persisted on the request.
    #[serde(default)]
    pub note: Option<String>,
}

/// Response body for `GET /` — one page of raw approval documents plus the
/// pagination envelope (`total` counts every match across all pages).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub approvals: Vec<Value>,
    /// Total requests matching the filter across all pages.
    pub total: u64,
    /// Resolved 1-based page number for this response.
    pub page: u64,
    /// Resolved page size (after default + cap clamping).
    pub limit: u64,
}

/// Response body for `POST /`, `POST /{id}/approve`, `POST /{id}/reject` —
/// a single raw approval document. `created` is `false` when `POST /`
/// returned an already-pending duplicate instead of inserting.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalResponse {
    #[schema(value_type = Object)]
    pub approval: Value,
    /// `POST /` only: `false` when an identical pending request already
    /// existed and was returned instead of a new insert. Always `true`
    /// for decide responses.
    pub created: bool,
}
