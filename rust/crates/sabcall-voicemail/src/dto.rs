//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::VoiceVoicemail;

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
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVoicemailInput {
    pub call_id: String,
    pub from_number: String,
    #[serde(default)]
    pub to_number: Option<String>,
    pub audio_file_id: String,
    #[serde(default)]
    pub duration_secs: Option<u32>,
    #[serde(default)]
    pub transcript: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVoicemailInput {
    #[serde(default)]
    pub transcript: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListenInput {
    /// User id of the listener — used to append to `listenedBy`.
    pub listener_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVoicemailResponse {
    pub id: String,
    pub entity: VoiceVoicemail,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteVoicemailResponse {
    pub deleted: bool,
}
