//! Request / response DTOs for `sabassist-actions-log`.

use serde::{Deserialize, Serialize};

use crate::types::SabassistActionLog;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub session_id: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub from: Option<String>,
    #[serde(default)]
    pub to: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateActionLogInput {
    pub session_id: String,
    pub action: String,
    /// Optional override; defaults to the caller's `userId`.
    #[serde(default)]
    pub actor_user_id: Option<String>,
    /// ISO-8601; defaults to now.
    #[serde(default)]
    pub ts: Option<String>,
    /// Free-form JSON payload.
    #[serde(default)]
    pub payload_json: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateActionLogResponse {
    pub id: String,
    pub entity: SabassistActionLog,
}
