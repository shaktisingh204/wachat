//! DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SablensChatMessage;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatInput {
    pub session_id: String,
    pub body: String,
    #[serde(default)]
    pub sender_kind: Option<String>,
    #[serde(default)]
    pub attachment_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendChatResponse {
    pub id: String,
    pub entity: SablensChatMessage,
}
