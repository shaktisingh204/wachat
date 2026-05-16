//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmUnit;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub unit_type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUnitInput {
    pub name: String,
    pub code: String,
    #[serde(default)]
    pub unit_type: Option<String>,
    #[serde(default)]
    pub base_unit_id: Option<String>,
    #[serde(default)]
    pub conversion_factor: Option<f64>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUnitInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub unit_type: Option<String>,
    #[serde(default)]
    pub base_unit_id: Option<String>,
    #[serde(default)]
    pub conversion_factor: Option<f64>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUnitResponse {
    pub id: String,
    pub entity: CrmUnit,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteUnitResponse {
    pub deleted: bool,
}
