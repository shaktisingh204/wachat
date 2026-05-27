//! Request / response DTOs for the SabShow comments HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::SabshowComment;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCommentsQuery {
    pub deck_id: String,
    #[serde(default)]
    pub slide_id: Option<String>,
    #[serde(default)]
    pub include_resolved: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub deck_id: String,
    pub slide_id: String,
    pub body: String,
    #[serde(default)]
    pub element_id: Option<String>,
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
pub struct CommentEnvelope {
    pub comment: SabshowComment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentListResponse {
    pub items: Vec<SabshowComment>,
}
