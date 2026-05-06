//! Wire DTOs for the Facebook Comments router.
//!
//! The TS originals returned free-form Graph API objects under loose keys
//! (`comments`, `replies`, `reactions`, …). We mirror that here using
//! `serde_json::Value` — the calling Next.js shim already understands the
//! Graph shapes and re-types as needed at the action boundary.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
//  Generic ack envelope (mirrors `{ success?, error? }`)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  handlePostComment  (POST /v1/facebook/comments/{object_id})
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct PostCommentBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub message: String,
}

// ---------------------------------------------------------------------------
//  handleDeleteComment  (DELETE /v1/facebook/comments/{comment_id})
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ProjectIdQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

// ---------------------------------------------------------------------------
//  handleLikeObject  (POST /v1/facebook/comments/{object_id}/likes)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct LikeObjectBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

// ---------------------------------------------------------------------------
//  getPostComments  (GET /v1/facebook/comments/post/{post_id})
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct PostCommentsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub comments: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getCommentReplies  (GET /v1/facebook/comments/{comment_id}/replies)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct CommentRepliesResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Vec<Object>)]
    pub replies: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  getObjectReactions  (GET /v1/facebook/comments/{object_id}/reactions)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, ToSchema)]
pub struct ReactionsResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub reactions: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ---------------------------------------------------------------------------
//  sendPrivateReply  (POST /v1/facebook/comments/{comment_id}/private-replies)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct PrivateReplyBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub message: String,
}
