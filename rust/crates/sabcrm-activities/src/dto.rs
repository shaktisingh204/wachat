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
    /// Optional `type` filter (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT | WHATSAPP).
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
    /// Entry kind (NOTE | TASK | CALL | MEETING | EMAIL | COMMENT | WHATSAPP).
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

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}` and
/// `DELETE /{id}/comments/{commentId}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

/// A single emoji reaction aggregated by emoji. Mirrors Twenty's lightweight
/// reaction model: one entry per distinct `emoji`, carrying the set of member
/// ids who reacted and a derived `count`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReactionGroup {
    /// The emoji (a short string, e.g. "👍" or ":thumbsup:").
    pub emoji: String,
    /// Member ids who reacted with this emoji.
    pub member_ids: Vec<String>,
    /// Convenience count = `member_ids.len()`.
    pub count: usize,
}

/// A single comment stored as a subdocument on an activity's `comments`
/// array. `id` is a fresh ObjectId hex assigned server-side; `createdAt`
/// is RFC3339 set at push time.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    /// Comment id — fresh ObjectId hex assigned server-side.
    pub id: String,
    /// Free-form comment body.
    pub body: String,
    /// Author user id.
    pub author_id: String,
    /// Workspace member ids @mentioned in the body (stored verbatim).
    #[serde(default)]
    pub mention_ids: Vec<String>,
    /// Emoji reactions on this comment, grouped by emoji.
    #[serde(default)]
    pub reactions: Vec<ReactionGroup>,
    /// Creation timestamp (RFC3339).
    pub created_at: String,
    /// Last edit timestamp (RFC3339); absent until the comment is edited.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_at: Option<String>,
    /// Human-friendly relative time derived from `created_at` (e.g. "2h ago").
    /// Computed server-side on read; never persisted.
    pub created_at_relative: String,
}

/// `POST /{id}/comments` body — append a comment to an activity.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddCommentInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Free-form comment body.
    pub body: String,
    /// Author user id.
    pub author_id: String,
    /// Workspace member ids @mentioned in the comment body (optional).
    #[serde(default)]
    pub mention_ids: Option<Vec<String>>,
}

/// `PATCH /{id}/comments/{commentId}` body — edit one's own comment. Only the
/// comment's original author (matched against the authenticated user) may
/// edit. `editedAt` is bumped server-side.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EditCommentInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// New comment body.
    pub body: String,
    /// Replacement set of @mentioned member ids (optional; absent = unchanged).
    #[serde(default)]
    pub mention_ids: Option<Vec<String>>,
}

/// `POST /{id}/reactions` and `POST /{id}/comments/{commentId}/reactions` body
/// — toggle the authenticated member's reaction with `emoji` on or off.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ToggleReactionInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The emoji to toggle.
    pub emoji: String,
}

/// Response body for reaction toggles — the updated reaction groups for the
/// target (activity or comment).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ReactionsResponse {
    pub reactions: Vec<ReactionGroup>,
}

/// Response body for `GET /{id}/comments` — the activity's comments array.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CommentListResponse {
    pub comments: Vec<Comment>,
}

/// Response body for `POST /{id}/comments` — the created comment.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CommentResponse {
    pub comment: Comment,
}
