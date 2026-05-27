//! Request / response DTOs for sabwriter-suggestions.

use serde::{Deserialize, Serialize};

use crate::types::{SabwriterSuggestion, SuggestionAnchor};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub document_id: String,
    /// `pending | accepted | rejected | all`. Default `all`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSuggestionInput {
    pub document_id: String,
    pub anchor: SuggestionAnchor,
    pub proposal_json: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSuggestionResponse {
    pub id: String,
    pub entity: SabwriterSuggestion,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabwriterSuggestion>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewResponse {
    pub ok: bool,
    pub entity: SabwriterSuggestion,
}
