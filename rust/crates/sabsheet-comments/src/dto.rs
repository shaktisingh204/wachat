//! Request / response DTOs for SabSheet comments.

use serde::{Deserialize, Serialize};

use crate::types::SabsheetComment;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workbook_id: String,
    #[serde(default)]
    pub sheet_id: Option<String>,
    #[serde(default)]
    pub include_resolved: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCommentInput {
    pub sheet_id: String,
    pub workbook_id: String,
    pub row: u32,
    pub col: u32,
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
    pub entity: SabsheetComment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsheetComment>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}
