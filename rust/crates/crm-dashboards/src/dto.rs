//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmDashboard;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active_visible"` (default) | `"archived"` | `"active"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    /// `"private"` | `"shared"`.
    #[serde(default)]
    pub scope: Option<String>,
    /// `"true"` to filter only defaults.
    #[serde(default)]
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDashboardInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub layout: Option<Document>,
    #[serde(default)]
    pub widgets: Option<Vec<Document>>,
    #[serde(default)]
    pub is_default: Option<bool>,
    /// `"private"` | `"shared"`.
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub owner_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDashboardInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub layout: Option<Document>,
    #[serde(default)]
    pub widgets: Option<Vec<Document>>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub owner_id: Option<String>,
    /// `"active"` | `"archived"`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDashboardResponse {
    pub id: String,
    pub entity: CrmDashboard,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDashboardResponse {
    pub deleted: bool,
}
