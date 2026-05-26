//! Request / response DTOs.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::types::BugSavedFilter;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// When `true`, return only filters owned by the caller (ignore shared).
    #[serde(default)]
    pub mine_only: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFilterInput {
    pub name: String,
    pub query_json: JsonValue,
    #[serde(default)]
    pub is_shared: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFilterInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub query_json: Option<JsonValue>,
    #[serde(default)]
    pub is_shared: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFilterResponse {
    pub id: String,
    pub entity: BugSavedFilter,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFilterResponse {
    pub deleted: bool,
}
