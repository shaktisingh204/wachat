//! Request / response DTOs for the sabwebinar-qna HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::QnaItem;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub webinar_id: Option<String>,
    /// `"answered"` | `"open"` | `"all"`.
    #[serde(default)]
    pub filter: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Public ask — no auth.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AskQuestionInput {
    pub webinar_id: String,
    pub question: String,
    #[serde(default)]
    pub asker_name: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnswerInput {
    pub answer: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpvoteInput {
    /// Voter handle (display name or join_token). Required for de-dup.
    pub voter: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AskQuestionResponse {
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
