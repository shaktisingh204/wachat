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
    /// Optional filter by notification kind
    /// (`mention` | `assignment` | `comment` | `system` | `info`).
    pub kind: Option<String>,
    /// Page size (1..=200). Defaults to 50, capped at 200.
    pub limit: Option<u64>,
    /// Zero-based offset into the result set (skip). Defaults to 0.
    /// Returned as `nextCursor` for the next page when more rows remain.
    pub cursor: Option<u64>,
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
    /// Optional kind: `mention` | `assignment` | `comment` | `system` |
    /// `info`. Unknown kinds are rejected. Defaults to `system` when absent.
    pub kind: Option<String>,
    /// Optional object slug the notification points at.
    pub target_object: Option<String>,
    /// Optional record id the notification points at.
    pub target_record_id: Option<String>,
    /// Optional id of the actor (`workspaceMembers` record) who triggered the
    /// notification. Defaults to the caller. Stored so the list can enrich it.
    pub actor_id: Option<String>,
    /// Optional pre-resolved actor display name (snapshot at creation time).
    pub actor_name: Option<String>,
    /// Optional pre-resolved actor avatar URL (snapshot at creation time).
    pub actor_avatar_url: Option<String>,
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

/// A resolved reference to the actor who triggered a notification. Injected
/// onto each list item under `actor` when the `actorId` resolves against the
/// project's `workspaceMembers` records (or from the stored snapshot).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ActorRef {
    /// The actor's `workspaceMembers` record id (hex).
    pub id: String,
    /// Display name for the actor.
    pub name: String,
    /// Avatar URL, when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,
}

/// Response body for `GET /` — the caller's notifications, newest first.
///
/// `notifications` carries each stored document (with `_id` → `id`), enriched
/// in place with an `actor` object when the triggering actor resolves. The
/// remaining fields describe the page: `total` is the full match count,
/// `nextCursor` is the offset to pass back as `cursor` for the next page (or
/// `null` when exhausted), and `hasMore` mirrors that as a boolean.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub notifications: Vec<Value>,
    /// Total notifications matching the filter (ignoring pagination).
    pub total: u64,
    /// Offset to pass as `cursor` for the next page, or `null` when the last
    /// page has been returned.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<u64>,
    /// Whether more rows remain beyond this page.
    pub has_more: bool,
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
