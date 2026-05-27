//! Request DTOs for sabtables tables.

use serde::{Deserialize, Serialize};

use crate::types::{SabtablesField, SabtablesTable};

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
    pub base_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableInput {
    pub base_id: String,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// If omitted, a single `Name` text field is generated and used as
    /// the primary field.
    #[serde(default)]
    pub fields: Option<Vec<SabtablesField>>,
    #[serde(default)]
    pub primary_field_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTableInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub fields: Option<Vec<SabtablesField>>,
    #[serde(default)]
    pub primary_field_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddFieldInput {
    pub field: SabtablesField,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFieldInput {
    pub field_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub options: Option<bson::Bson>,
    #[serde(default)]
    pub is_required: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTableResponse {
    pub id: String,
    pub entity: SabtablesTable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTableResponse {
    pub deleted: bool,
}
