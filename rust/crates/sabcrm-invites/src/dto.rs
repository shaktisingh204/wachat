//! Wire-format DTOs for the SabCRM invites HTTP surface.
//!
//! An invite document is persisted as:
//!
//! ```text
//! { _id, projectId, email, roleId?, status, token, invitedBy, createdAt, acceptedAt? }
//! ```
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list a project's invites, optionally by status.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional status filter (`pending` | `accepted` | `revoked`).
    #[serde(default)]
    pub status: Option<String>,
}

/// `POST /` body — create a pending invite for the caller's project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateInviteInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Invitee email — required.
    pub email: String,
    /// Role to grant on acceptance — optional.
    #[serde(default)]
    pub role_id: Option<String>,
}

/// Query params for endpoints that only need the tenant scope
/// (`POST /{id}/revoke`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Response body for `GET /` — the project's invites, newest first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub invites: Vec<Value>,
}

/// Response body for `POST /` and `POST /{id}/revoke` — a single invite.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct InviteResponse {
    #[schema(value_type = Object)]
    pub invite: Value,
}

/// Response body for `POST /{id}/revoke` — `{ ok, invite }`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RevokeResponse {
    pub ok: bool,
    #[schema(value_type = Object)]
    pub invite: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
