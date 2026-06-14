//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::AgentPresence;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub queue_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPresenceInput {
    pub agent_user_id: String,
    pub status: String,
    #[serde(default)]
    pub active_call_id: Option<String>,
    #[serde(default)]
    pub queue_ids: Option<Vec<String>>,
    #[serde(default)]
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceListResponse {
    pub items: Vec<AgentPresence>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceUpsertResponse {
    pub entity: AgentPresence,
}
