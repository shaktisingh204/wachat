//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmSetting;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` (default) | `"archived"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by category bucket.
    #[serde(default)]
    pub category: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSettingInput {
    pub key: String,
    #[serde(default)]
    pub value: Option<Document>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_secret: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingInput {
    #[serde(default)]
    pub key: Option<String>,
    #[serde(default)]
    pub value: Option<Document>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_secret: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSettingResponse {
    pub id: String,
    pub entity: CrmSetting,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSettingResponse {
    pub deleted: bool,
}
