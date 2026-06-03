//! Wire-format DTOs for the SabCRM notifications HTTP surface.
//!
//! The `userId` defaults to the caller (from `AuthUser`); `POST /` may
//! override it to fan a notification out to another user. List responses
//! return the stored document verbatim (cleaned via
//! `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the caller's notifications for a project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// When `true`, only unread notifications are returned.
    #[serde(default)]
    pub unread_only: Option<bool>,
}

/// `GET /count` query params — unread count for the caller in a project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CountQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a notification. `userId` defaults to the caller
/// but may be set to fan out to another user.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateNotificationInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Recipient user id. Defaults to the caller when absent.
    pub user_id: Option<String>,
    /// Notification title — required.
    pub title: String,
    /// Optional longer body text.
    pub body: Option<String>,
    /// Optional kind: `info` | `mention` | `assignment` | `system`.
    pub kind: Option<String>,
    /// Optional object slug the notification points at.
    pub target_object: Option<String>,
    /// Optional record id the notification points at.
    pub target_record_id: Option<String>,
}

/// `POST /{id}/read` body — mark a notification read or unread.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarkReadInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Desired read state.
    pub read: bool,
}

/// `POST /read-all` body — mark all the caller's notifications read.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MarkAllReadInput {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `DELETE /{id}` query params — scope a delete to a project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Response body for `GET /` — the caller's notifications, newest first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub notifications: Vec<Value>,
}

/// Response body for `GET /count` — the caller's unread count.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CountResponse {
    pub unread: u64,
}

/// Response body for `POST /` and `POST /{id}/read` — the notification.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NotificationResponse {
    #[schema(value_type = Object)]
    pub notification: Value,
}

/// Response body for `POST /read-all` — `{ ok, updated }`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ReadAllResponse {
    pub ok: bool,
    pub updated: u64,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
