//! Form-analytics DTOs.

use serde::{Deserialize, Serialize};

use crate::types::FieldDropoff;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub site_id: String,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertFormAnalyticsInput {
    pub site_id: String,
    pub form_selector: String,
    #[serde(default)]
    pub per_field_dropoff: Vec<FieldDropoff>,
    #[serde(default)]
    pub completion_rate: Option<f32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}
