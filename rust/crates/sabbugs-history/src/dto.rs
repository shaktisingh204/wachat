//! Request / response DTOs.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::BugHistoryEntry;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    pub bug_id: String,
    #[serde(default)]
    pub field: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHistoryInput {
    pub bug_id: String,
    pub field: String,
    #[serde(default)]
    pub old_value: Option<JsonValue>,
    #[serde(default)]
    pub new_value: Option<JsonValue>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHistoryResponse {
    pub id: String,
    pub entity: BugHistoryEntry,
}
