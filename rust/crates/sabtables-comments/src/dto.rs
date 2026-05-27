//! Request DTOs for sabtables comments.

use serde::{Deserialize, Serialize};

use crate::types::SabtablesComment;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub record_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub record_id: String,
    pub table_id: String,
    pub body: String,
    #[serde(default)]
    pub parent_comment_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCommentInput {
    pub body: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentResponse {
    pub id: String,
    pub entity: SabtablesComment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCommentResponse {
    pub deleted: bool,
}
