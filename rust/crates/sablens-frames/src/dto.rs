//! DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SablensFrame;

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
pub struct CreateFrameInput {
    pub session_id: String,
    pub file_id: String,
    #[serde(default)]
    pub device_orientation: Option<i32>,
    #[serde(default)]
    pub sensor_info_json: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFrameResponse {
    pub id: String,
    pub entity: SablensFrame,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFrameResponse {
    pub deleted: bool,
}
