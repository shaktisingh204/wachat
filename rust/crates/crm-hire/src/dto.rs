//! Request DTOs.

use bson::DateTime as BsonDateTime;
use serde::{Deserialize, Serialize};

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
    pub stage: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHireInput {
    pub title: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub vendor_candidate: Option<String>,
    #[serde(default)]
    pub required_by: Option<BsonDateTime>,
    #[serde(default)]
    pub quantity: Option<f64>,
    #[serde(default)]
    pub estimated_budget: Option<f64>,
    #[serde(default)]
    pub specs: Option<String>,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateHireInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub vendor_candidate: Option<String>,
    #[serde(default)]
    pub required_by: Option<BsonDateTime>,
    #[serde(default)]
    pub quantity: Option<f64>,
    #[serde(default)]
    pub estimated_budget: Option<f64>,
    #[serde(default)]
    pub specs: Option<String>,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateHireResponse {
    pub id: String,
    pub entity: crate::types::CrmHire,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteHireResponse {
    pub deleted: bool,
}
