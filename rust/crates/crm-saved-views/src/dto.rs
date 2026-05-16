//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmSavedView;

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
    /// Filter by entity key — `"leads"`, `"deals"`, etc.
    #[serde(default)]
    pub entity: Option<String>,
    /// `"private"` | `"shared"`.
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSavedViewInput {
    pub name: String,
    pub entity: String,
    #[serde(default)]
    pub filters: Option<Document>,
    #[serde(default)]
    pub columns: Option<Vec<String>>,
    #[serde(default)]
    pub sort: Option<Document>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSavedViewInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub entity: Option<String>,
    #[serde(default)]
    pub filters: Option<Document>,
    #[serde(default)]
    pub columns: Option<Vec<String>>,
    #[serde(default)]
    pub sort: Option<Document>,
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSavedViewResponse {
    pub id: String,
    pub entity: CrmSavedView,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSavedViewResponse {
    pub deleted: bool,
}
