//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::VoiceApplication;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"disabled"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by application type — `"webhook"` | `"ivr"` | `"queue"` | `"dial"` | `"autopilot"`.
    #[serde(default, rename = "type")]
    pub app_type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateApplicationInput {
    pub name: String,
    #[serde(default, rename = "type")]
    pub app_type: Option<String>,
    #[serde(default)]
    pub webhook_url: Option<String>,
    #[serde(default)]
    pub ivr_id: Option<String>,
    #[serde(default)]
    pub queue_id: Option<String>,
    #[serde(default)]
    pub dial_target: Option<String>,
    #[serde(default)]
    pub fallback_url: Option<String>,
    #[serde(default)]
    pub record_calls: Option<bool>,
    #[serde(default)]
    pub stt_enabled: Option<bool>,
    #[serde(default)]
    pub tts_voice: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateApplicationInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, rename = "type")]
    pub app_type: Option<String>,
    #[serde(default)]
    pub webhook_url: Option<String>,
    #[serde(default)]
    pub ivr_id: Option<String>,
    #[serde(default)]
    pub queue_id: Option<String>,
    #[serde(default)]
    pub dial_target: Option<String>,
    #[serde(default)]
    pub fallback_url: Option<String>,
    #[serde(default)]
    pub record_calls: Option<bool>,
    #[serde(default)]
    pub stt_enabled: Option<bool>,
    #[serde(default)]
    pub tts_voice: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateApplicationResponse {
    pub id: String,
    pub entity: VoiceApplication,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteApplicationResponse {
    pub deleted: bool,
}
