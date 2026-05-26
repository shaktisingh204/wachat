//! Request DTOs for `/v1/sabrewards/catalog`.

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
    pub program_id: Option<String>,
    #[serde(default)]
    pub active_only: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCatalogItemInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub program_id: Option<String>,
    #[serde(default)]
    pub image_file_id: Option<String>,
    pub points_cost: i64,
    #[serde(default)]
    pub stock: Option<i64>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCatalogItemInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub program_id: Option<String>,
    #[serde(default)]
    pub image_file_id: Option<String>,
    #[serde(default)]
    pub points_cost: Option<i64>,
    #[serde(default)]
    pub stock: Option<i64>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCatalogItemResponse {
    pub id: String,
    pub entity: crate::types::RewardsCatalogItem,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCatalogItemResponse {
    pub deleted: bool,
}
