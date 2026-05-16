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
    pub direction: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLoanInput {
    pub party_name: String,
    #[serde(default)]
    pub direction: Option<String>,
    pub principal: f64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub interest_rate: Option<f64>,
    #[serde(default)]
    pub tenure_months: Option<i32>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub emi: Option<f64>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLoanInput {
    #[serde(default)]
    pub party_name: Option<String>,
    #[serde(default)]
    pub direction: Option<String>,
    #[serde(default)]
    pub principal: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub interest_rate: Option<f64>,
    #[serde(default)]
    pub tenure_months: Option<i32>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub emi: Option<f64>,
    #[serde(default)]
    pub outstanding: Option<f64>,
    #[serde(default)]
    pub paid: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLoanResponse {
    pub id: String,
    pub entity: crate::types::CrmLoan,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteLoanResponse {
    pub deleted: bool,
}
