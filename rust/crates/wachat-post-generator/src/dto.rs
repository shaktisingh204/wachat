//! Wire DTOs for the wachat post-generator surface.
//!
//! `camelCase` to match the JSON the `/wachat/post-generator` page sends.
//! AI generation does NOT live here — it stays in the Next streaming route
//! (`/wachat/post-generator/api`). This crate only persists the drafts the
//! user keeps, records publish intents, and performs the Meta Graph publish.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ===========================================================================
// Drafts
// ===========================================================================

/// Query for `GET /drafts?projectId=` and `GET /publish-log?projectId=`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProjectQuery {
    /// Project (hex ObjectId) whose rows to list. Required — every read is
    /// project-scoped under the owner-or-agent guard.
    pub project_id: String,
}

/// Body for `POST /drafts`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SaveDraftBody {
    /// Project (hex ObjectId) the draft belongs to.
    pub project_id: String,
    /// Optional human title/label for the draft.
    #[serde(default)]
    pub title: Option<String>,
    /// The post copy.
    pub body: String,
    /// Intended destination: `"facebook"` or `"whatsapp-status"`. Free-form
    /// label; defaults to `"facebook"` when omitted.
    #[serde(default)]
    pub channel: Option<String>,
}

/// `GET /drafts` response — the project's drafts as cleaned JSON docs.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListDraftsResponse {
    #[schema(value_type = Vec<Object>)]
    pub drafts: Vec<Value>,
}

// ===========================================================================
// Publish
// ===========================================================================

/// Body for `POST /publish/facebook` and `POST /publish/whatsapp-status`.
///
/// Either reference a saved draft (`draftId`) or pass inline `text`. At
/// least one must resolve to a non-empty body.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublishBody {
    /// Project (hex ObjectId) that owns the FB page token / draft.
    pub project_id: String,
    /// Saved draft to publish (hex ObjectId). Optional if `text` is given.
    #[serde(default)]
    pub draft_id: Option<String>,
    /// Inline post copy. Optional if `draft_id` is given.
    #[serde(default)]
    pub text: Option<String>,
}

/// Result of a publish attempt (FB feed or WhatsApp-status intent).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublishResponse {
    pub success: bool,
    /// The publish_log row id (hex) recorded for this attempt.
    pub log_id: String,
    /// `"published"`, `"queued"`, or `"failed"`.
    pub status: String,
    /// Meta object id of the new post, when the Graph call succeeded.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_id: Option<String>,
    /// Failure reason, when `status == "failed"`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// `GET /publish-log` response — history of publish attempts.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PublishLogResponse {
    #[schema(value_type = Vec<Object>)]
    pub entries: Vec<Value>,
}

/// Generic `{ success: true }` envelope (DELETE).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
