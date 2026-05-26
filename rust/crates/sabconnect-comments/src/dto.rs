//! Request / response DTOs for SabConnect comments.

use serde::{Deserialize, Serialize};

use crate::types::SabConnectComment;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub item_id: String,
    #[serde(default)]
    pub parent_comment_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub item_id: String,
    #[serde(default)]
    pub parent_comment_id: Option<String>,
    pub author_id: String,
    #[serde(default)]
    pub author_name: Option<String>,
    #[serde(default)]
    pub author_avatar_url: Option<String>,
    pub body: String,
    #[serde(default)]
    pub attachment_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCommentInput {
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub attachment_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCommentsResponse {
    pub items: Vec<SabConnectComment>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentResponse {
    pub id: String,
    pub entity: SabConnectComment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCommentResponse {
    pub deleted: bool,
}
