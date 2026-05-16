//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmReplyTemplate;

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
    pub category: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReplyTemplateInput {
    pub name: String,
    pub body: String,
    #[serde(default)]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub variables: Option<Vec<String>>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateReplyTemplateInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub variables: Option<Vec<String>>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub usage_count: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReplyTemplateResponse {
    pub id: String,
    pub entity: CrmReplyTemplate,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteReplyTemplateResponse {
    pub deleted: bool,
}
