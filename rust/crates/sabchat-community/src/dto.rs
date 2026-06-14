//! Wire-format DTOs for the SabChat **community forum** endpoints.
//!
//! Mirrors the document shape of `sabchat_community_topics` /
//! `sabchat_community_posts`. Every body uses
//! `#[serde(rename_all = "camelCase")]` so JSON requests and responses
//! round-trip with the TS clients exactly like the sibling routers do.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Accepted lifecycle states for a topic. `open` (awaiting an answer),
/// `answered` (an accepted answer exists), `closed` (locked by a mod).
pub const VALID_TOPIC_STATUSES: &[&str] = &["open", "answered", "closed"];

// ---------------------------------------------------------------------------
// POST /topics
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTopicBody {
    pub title: String,
    pub body: String,
    #[serde(default)]
    pub category: Option<String>,
    /// Display name for the author, resolved by the caller from session.
    #[serde(default)]
    pub author_name: Option<String>,
}

// ---------------------------------------------------------------------------
// PATCH /topics/{id} — partial; moderation + author edits
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTopicBody {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    /// One of [`VALID_TOPIC_STATUSES`].
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub pinned: Option<bool>,
}

// ---------------------------------------------------------------------------
// POST /topics/{id}/posts — add a reply
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePostBody {
    pub body: String,
    /// Display name for the author, resolved by the caller from session.
    #[serde(default)]
    pub author_name: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /topics — list filters (query string)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTopicsQuery {
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    /// `recent` (default — last activity) or `top` (most upvoted).
    #[serde(default)]
    pub sort: Option<String>,
    #[serde(default)]
    pub limit: Option<i64>,
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IdResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpvoteResponse {
    pub id: String,
    /// Resulting vote count after the toggle.
    pub upvotes: i64,
    /// `true` if the caller is now an upvoter, `false` if they un-voted.
    pub voted: bool,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListTopicsResponse {
    #[schema(value_type = Vec<Object>)]
    pub topics: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TopicDetailResponse {
    #[schema(value_type = Object)]
    pub topic: Value,
    #[schema(value_type = Vec<Object>)]
    pub posts: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub message: String,
}
