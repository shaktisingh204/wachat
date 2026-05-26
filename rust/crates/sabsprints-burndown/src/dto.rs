//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::AgileBurndownSample;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub sprint_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordSampleInput {
    pub sprint_id: String,
    pub day: u32,
    /// RFC3339 (defaults to now).
    #[serde(default)]
    pub sample_date: Option<String>,
    pub remaining_points: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordSampleResponse {
    pub id: String,
    pub entity: AgileBurndownSample,
}
