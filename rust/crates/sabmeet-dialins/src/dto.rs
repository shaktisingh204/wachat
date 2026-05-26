//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::DialIn;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub region_code: Option<String>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub active_only: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDialInInput {
    pub region_code: String,
    pub label: String,
    pub phone_number: String,
    /// `"required"` | `"optional"` | `"none"`.
    #[serde(default)]
    pub pin_policy: Option<String>,
    #[serde(default)]
    pub toll_free: Option<bool>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDialInInput {
    #[serde(default)]
    pub region_code: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub phone_number: Option<String>,
    #[serde(default)]
    pub pin_policy: Option<String>,
    #[serde(default)]
    pub toll_free: Option<bool>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDialInResponse {
    pub id: String,
    pub entity: DialIn,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDialInResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<DialIn>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
