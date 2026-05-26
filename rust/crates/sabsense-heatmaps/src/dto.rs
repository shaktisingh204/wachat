//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub site_id: String,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub variant: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

/// Triggers an on-demand aggregation pass over
/// `pagesense_heatmap_events`. Currently a stub that creates an empty
/// snapshot; the real binning lives behind a TODO.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegenerateInput {
    pub site_id: String,
    pub url: String,
    #[serde(default)]
    pub variant: Option<String>,
    /// Aggregation window in epoch ms.
    pub period_from_ms: i64,
    pub period_to_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegenerateResponse {
    pub id: String,
    pub sample_size: u64,
}
