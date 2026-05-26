//! Request / response DTOs for SabConnect reactions.

use serde::{Deserialize, Serialize};

use crate::types::SabConnectReaction;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub item_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleReactionInput {
    pub item_id: String,
    pub reactor_id: String,
    #[serde(default)]
    pub reactor_name: Option<String>,
    pub emoji: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToggleReactionResponse {
    pub added: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity: Option<SabConnectReaction>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListReactionsResponse {
    pub items: Vec<SabConnectReaction>,
    pub count_by_emoji: std::collections::BTreeMap<String, i64>,
}
