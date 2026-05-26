//! Request DTOs for field analytics.

use serde::{Deserialize, Serialize};

use crate::types::{EnvelopeFieldSummary, FieldUsageBucket};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageQuery {
    /// Limit results to envelopes with this status.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageResponse {
    pub buckets: Vec<FieldUsageBucket>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerEnvelopeQuery {
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerEnvelopeResponse {
    pub items: Vec<EnvelopeFieldSummary>,
}
