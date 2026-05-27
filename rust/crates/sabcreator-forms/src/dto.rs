//! Request DTOs for sabcreator forms.

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::types::SabcreatorForm;

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
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFormInput {
    pub app_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub sabtables_table_id: Option<String>,
    #[serde(default)]
    pub fields_json: Option<Value>,
    #[serde(default)]
    pub layout_json: Option<Value>,
    #[serde(default)]
    pub submit_action: Option<String>,
    #[serde(default)]
    pub submit_workflow_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFormInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub sabtables_table_id: Option<String>,
    #[serde(default)]
    pub fields_json: Option<Value>,
    #[serde(default)]
    pub layout_json: Option<Value>,
    #[serde(default)]
    pub submit_action: Option<String>,
    #[serde(default)]
    pub submit_workflow_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFormResponse {
    pub id: String,
    pub entity: SabcreatorForm,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFormResponse {
    pub deleted: bool,
}
