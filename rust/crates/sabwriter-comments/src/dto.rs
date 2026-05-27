//! Request / response DTOs for sabwriter-comments.

use serde::{Deserialize, Serialize};

use crate::types::{CommentAnchor, SabwriterComment};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub document_id: String,
    /// `open | resolved | all`. Default `all`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub document_id: String,
    pub anchor: CommentAnchor,
    pub body: String,
    #[serde(default)]
    pub parent_comment_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCommentInput {
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub resolved: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentResponse {
    pub id: String,
    pub entity: SabwriterComment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCommentResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabwriterComment>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
