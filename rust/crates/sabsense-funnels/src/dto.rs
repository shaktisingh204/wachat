//! Funnel DTOs.

use serde::{Deserialize, Serialize};

use crate::types::FunnelStep;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub site_id: String,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFunnelInput {
    pub site_id: String,
    pub name: String,
    pub steps: Vec<FunnelStep>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFunnelInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub steps: Option<Vec<FunnelStep>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFunnelResponse {
    pub id: String,
    pub entity: crate::types::Funnel,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFunnelResponse {
    pub deleted: bool,
}
