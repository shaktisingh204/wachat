//! Request DTOs for sabsense-tax-forms.

use serde::{Deserialize, Serialize};

use crate::types::SabsenseTaxForm;

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
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemInput {
    pub form_type: String,
    pub tax_id: String,
    pub status: String,

}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemInput {
    #[serde(default)]
    pub form_type: Option<String>,
    #[serde(default)]
    pub tax_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,

}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemResponse {
    pub id: String,
    pub entity: SabsenseTaxForm,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteItemResponse {
    pub deleted: bool,
}
