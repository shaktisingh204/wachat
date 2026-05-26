//! Request / response DTOs for SabConnect custom apps.

use serde::{Deserialize, Serialize};

use crate::types::SabConnectCustomApp;

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
pub struct CreateCustomAppInput {
    pub name: String,
    pub url: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon_file_id: Option<String>,
    #[serde(default)]
    pub open_in: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomAppInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon_file_id: Option<String>,
    #[serde(default)]
    pub open_in: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomAppResponse {
    pub id: String,
    pub entity: SabConnectCustomApp,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCustomAppResponse {
    pub deleted: bool,
}
