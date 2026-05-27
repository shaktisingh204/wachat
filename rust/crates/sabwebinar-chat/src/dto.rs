//! Request / response DTOs for the sabwebinar-chat HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::ChatMessage;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub webinar_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// RFC3339 — return messages newer than this.
    #[serde(default)]
    pub since: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatInput {
    pub webinar_id: String,
    #[serde(default)]
    pub session_id: Option<String>,
    pub sender_name: String,
    pub body: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatResponse {
    pub id: String,
    pub entity: ChatMessage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<ChatMessage>,
}
