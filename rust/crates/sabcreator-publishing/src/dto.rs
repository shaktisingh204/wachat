//! Request DTOs for sabcreator publications.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::types::SabcreatorPublication;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub app_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishInput {
    pub app_id: String,
    pub snapshot_json: Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishResponse {
    pub id: String,
    pub version: u32,
    pub entity: SabcreatorPublication,
}
