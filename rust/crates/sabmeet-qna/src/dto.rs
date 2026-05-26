//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::QnaItem;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub room_id: Option<String>,
    /// `"all"` (default) | `"open"` (unanswered) | `"answered"`.
    #[serde(default)]
    pub state: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskInput {
    pub room_id: String,
    pub question: String,
    #[serde(default)]
    pub asker_name: Option<String>,
    #[serde(default)]
    pub asker_user_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnswerInput {
    pub answer: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpvoteInput {
    pub voter: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskResponse {
    pub id: String,
    pub entity: QnaItem,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<QnaItem>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
