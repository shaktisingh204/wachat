//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmDocumentTemplate;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"draft" | "active" | "archived" | "all"`. Default excludes archived.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateVariableInput {
    pub name: String,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub default: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentTemplateInput {
    pub name: String,
    /// `"Contract" | "Policy" | "Offer" | "Other"`. Defaults to `"Other"`.
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub variables: Vec<TemplateVariableInput>,
    #[serde(default)]
    pub template_file_url: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    /// `"draft"` is the default for newly-created templates.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocumentTemplateInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub body: Option<String>,
    #[serde(default)]
    pub variables: Option<Vec<TemplateVariableInput>>,
    #[serde(default)]
    pub template_file_url: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentTemplateResponse {
    pub id: String,
    pub entity: CrmDocumentTemplate,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDocumentTemplateResponse {
    pub deleted: bool,
}
