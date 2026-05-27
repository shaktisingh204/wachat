//! Request / response DTOs for the SabShow versions HTTP surface.

use serde::{Deserialize, Serialize};

use crate::types::SabshowVersion;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListVersionsQuery {
    pub deck_id: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Body for `POST /v1/sabshow/versions`. The TS server action is
/// responsible for serialising the deck tree into a JSON blob, uploading
/// it to SabFiles, then sending us the resulting `snapshotFileId`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionInput {
    pub deck_id: String,
    pub snapshot_file_id: String,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub thumbnail_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionEnvelope {
    pub version: SabshowVersion,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionListResponse {
    pub items: Vec<SabshowVersion>,
}
