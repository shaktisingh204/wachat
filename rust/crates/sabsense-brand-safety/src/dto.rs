//! Request DTOs for sabsense-brand-safety.

use serde::{Deserialize, Serialize};
use crate::types::BrandSafetyReport;

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
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemInput {
    pub url: String,
    #[serde(default)]
pub safety_score: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemInput {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub safety_score: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemResponse {
    pub id: String,
    pub entity: BrandSafetyReport,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteItemResponse {
    pub deleted: bool,
}
