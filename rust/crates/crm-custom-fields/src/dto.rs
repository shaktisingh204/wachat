//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmCustomField;

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
    /// Filter by the entity the field attaches to (`"contact"`, `"deal"`, ...).
    #[serde(default)]
    pub entity_kind: Option<String>,
    #[serde(default)]
    pub field_type: Option<String>,
    #[serde(default)]
    pub section: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomFieldInput {
    pub entity_kind: String,
    pub name: String,
    pub label: String,
    pub field_type: String,

    #[serde(default)]
    pub help_text: Option<String>,
    #[serde(default)]
    pub placeholder: Option<String>,
    #[serde(default)]
    pub default_value: Option<Document>,
    #[serde(default)]
    pub required: Option<bool>,
    #[serde(default)]
    pub unique: Option<bool>,
    #[serde(default)]
    pub options: Option<Vec<Document>>,
    #[serde(default)]
    pub validation: Option<Document>,
    #[serde(default)]
    pub display_order: Option<i32>,
    #[serde(default)]
    pub section: Option<String>,
    #[serde(default)]
    pub visible_in_list: Option<bool>,
    #[serde(default)]
    pub visible_in_form: Option<bool>,
    #[serde(default)]
    pub editable_in_form: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomFieldInput {
    #[serde(default)]
    pub entity_kind: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub label: Option<String>,
    #[serde(default)]
    pub field_type: Option<String>,
    #[serde(default)]
    pub help_text: Option<String>,
    #[serde(default)]
    pub placeholder: Option<String>,
    #[serde(default)]
    pub default_value: Option<Document>,
    #[serde(default)]
    pub required: Option<bool>,
    #[serde(default)]
    pub unique: Option<bool>,
    #[serde(default)]
    pub options: Option<Vec<Document>>,
    #[serde(default)]
    pub validation: Option<Document>,
    #[serde(default)]
    pub display_order: Option<i32>,
    #[serde(default)]
    pub section: Option<String>,
    #[serde(default)]
    pub visible_in_list: Option<bool>,
    #[serde(default)]
    pub visible_in_form: Option<bool>,
    #[serde(default)]
    pub editable_in_form: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomFieldResponse {
    pub id: String,
    pub entity: CrmCustomField,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCustomFieldResponse {
    pub deleted: bool,
}
