//! Recording DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub site_id: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    /// Minimum recording duration in seconds.
    #[serde(default)]
    pub min_duration: Option<u32>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertRecordingInput {
    pub site_id: String,
    pub session_id: String,
    pub started_at_ms: i64,
    #[serde(default)]
    pub ended_at_ms: Option<i64>,
    pub duration_secs: u32,
    pub url_path: String,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    /// SabFiles id of the finalized event blob, if any.
    #[serde(default)]
    pub events_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertRecordingResponse {
    pub id: String,
}
