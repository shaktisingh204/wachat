//! Request DTOs for sabcreator pages.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::types::SabcreatorPage;

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
    pub app_id: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePageInput {
    pub app_id: String,
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
    pub kind: String,
    #[serde(default)]
    pub config_json: Option<Value>,
    #[serde(default)]
    pub role_visibility: Option<String>,
    #[serde(default)]
    pub allowed_role_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePageInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub config_json: Option<Value>,
    #[serde(default)]
    pub role_visibility: Option<String>,
    #[serde(default)]
    pub allowed_role_ids: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePageResponse {
    pub id: String,
    pub entity: SabcreatorPage,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePageResponse {
    pub deleted: bool,
}
