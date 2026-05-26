//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::Poll;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub room_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePollInput {
    pub room_id: String,
    pub question: String,
    /// Plain-text option labels — server assigns stable string ids.
    pub options: Vec<String>,
    #[serde(default)]
    pub multi_select: Option<bool>,
    #[serde(default)]
    pub anonymous: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VoteInput {
    /// One or more option ids depending on multiSelect.
    pub option_ids: Vec<String>,
    pub voter: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePollResponse {
    pub id: String,
    pub entity: Poll,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Poll>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
