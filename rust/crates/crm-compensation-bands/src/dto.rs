//! Request DTOs for the Compensation Band entity.

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
    pub level: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct CreateCompensationBandInput {
    pub name: String,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub min_salary: Option<f64>,
    #[serde(default)]
    pub max_salary: Option<f64>,
    #[serde(default)]
    pub mid_salary: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub role_title: Option<String>,
    #[serde(default)]
    pub perks: Vec<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct UpdateCompensationBandInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub min_salary: Option<f64>,
    #[serde(default)]
    pub max_salary: Option<f64>,
    #[serde(default)]
    pub mid_salary: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub role_title: Option<String>,
    #[serde(default)]
    pub perks: Option<Vec<String>>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCompensationBandResponse {
    pub id: String,
    pub entity: crate::types::CrmCompensationBand,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCompensationBandResponse {
    pub deleted: bool,
}
