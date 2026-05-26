//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::VoiceDid;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"pending"` | `"released"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub country: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDidInput {
    pub number: String,
    pub country: String,
    pub provider: String,
    #[serde(default)]
    pub capabilities: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub provider_ref: Option<String>,
    #[serde(default)]
    pub monthly_cost: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub route_to_ivr_id: Option<String>,
    #[serde(default)]
    pub route_to_queue_id: Option<String>,
    #[serde(default)]
    pub route_to_user_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDidInput {
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub capabilities: Option<Vec<String>>,
    #[serde(default)]
    pub monthly_cost: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub route_to_ivr_id: Option<String>,
    #[serde(default)]
    pub route_to_queue_id: Option<String>,
    #[serde(default)]
    pub route_to_user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDidResponse {
    pub id: String,
    pub entity: VoiceDid,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDidResponse {
    pub deleted: bool,
}

/// Mock provider search — returns synthetic available numbers.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub country: String,
    #[serde(default)]
    pub area_code: Option<String>,
    #[serde(default)]
    pub contains: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AvailableNumber {
    pub number: String,
    pub country: String,
    pub capabilities: Vec<String>,
    pub monthly_cost: f64,
    pub currency: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub items: Vec<AvailableNumber>,
}
