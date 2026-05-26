//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::BugComment;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    pub bug_id: String,
    #[serde(default)]
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub bug_id: String,
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
pub struct CreateCommentResponse {
    pub id: String,
    pub entity: BugComment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCommentResponse {
    pub deleted: bool,
}
