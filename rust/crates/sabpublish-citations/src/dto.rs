//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub location_id: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestCitationInput {
    pub location_id: String,
    pub source_url: String,
    #[serde(default)]
    pub found_name: Option<String>,
    #[serde(default)]
    pub found_address: Option<String>,
    #[serde(default)]
    pub found_phone: Option<String>,
    pub match_score: u8,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCitationInput {
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestCitationResponse {
    pub id: String,
    pub entity: crate::types::SabpublishCitation,
}
