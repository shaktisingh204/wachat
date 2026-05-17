//! Request DTOs.

use serde::{Deserialize, Serialize};

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
    pub financial_year: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateForm16Input {
    #[serde(default)]
    pub employee_id: Option<String>,
    pub employee_name: String,
    pub financial_year: String,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub tan_of_employer: Option<String>,
    #[serde(default)]
    pub total_income: Option<f64>,
    #[serde(default)]
    pub tax_deducted: Option<f64>,
    #[serde(default)]
    pub document_url: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateForm16Input {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub financial_year: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default)]
    pub tan_of_employer: Option<String>,
    #[serde(default)]
    pub total_income: Option<f64>,
    #[serde(default)]
    pub tax_deducted: Option<f64>,
    #[serde(default)]
    pub document_url: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateForm16Response {
    pub id: String,
    pub entity: crate::types::CrmForm16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteForm16Response {
    pub deleted: bool,
}
