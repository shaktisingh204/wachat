//! Funnel-run DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub funnel_id: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunFunnelInput {
    pub funnel_id: String,
    /// Aggregation window in epoch ms.
    pub period_from_ms: i64,
    pub period_to_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunFunnelResponse {
    pub id: String,
    pub total_sessions: u64,
}
