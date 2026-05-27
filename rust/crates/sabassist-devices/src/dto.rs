//! Request / response DTOs for `sabassist-devices`.

use serde::{Deserialize, Serialize};

use crate::types::SabassistDevice;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub online: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeviceInput {
    pub label: String,
    #[serde(default)]
    pub owner_user_id: Option<String>,
    pub device_fingerprint: String,
    #[serde(default)]
    pub agent_version: Option<String>,
    #[serde(default)]
    pub os_info_json: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDeviceInput {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub owner_user_id: Option<String>,
    #[serde(default)]
    pub agent_version: Option<String>,
    #[serde(default)]
    pub os_info_json: Option<serde_json::Value>,
    #[serde(default)]
    pub online: Option<bool>,
    /// ISO-8601; supply `now` to bump the heartbeat.
    #[serde(default)]
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeviceResponse {
    pub id: String,
    pub entity: SabassistDevice,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDeviceResponse {
    pub deleted: bool,
}
