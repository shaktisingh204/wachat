//! DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SablensActionLog;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendActionInput {
    pub session_id: String,
    pub action: String,
    #[serde(default)]
    pub actor_kind: Option<String>,
    #[serde(default)]
    pub payload_json: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendActionResponse {
    pub id: String,
    pub entity: SablensActionLog,
}
