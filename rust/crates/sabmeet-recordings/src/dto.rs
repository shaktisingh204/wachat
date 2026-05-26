//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{Recording, TranscriptCue};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub room_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRecordingInput {
    pub room_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteRecordingInput {
    /// SabFiles file id.
    pub file_id: String,
    #[serde(default)]
    pub audio_file_id: Option<String>,
    #[serde(default)]
    pub transcript_file_id: Option<String>,
    #[serde(default)]
    pub transcript: Option<Vec<TranscriptCue>>,
    #[serde(default)]
    pub duration_secs: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailRecordingInput {
    pub error_message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordingResponse {
    pub id: String,
    pub entity: Recording,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Recording>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecordingResponse {
    pub deleted: bool,
}
