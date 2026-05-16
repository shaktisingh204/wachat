//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmPayslip;

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
    pub employee_id: Option<String>,
    #[serde(default)]
    pub pay_period: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayslipInput {
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    pub pay_period: String,
    pub basic: f64,
    pub hra: f64,
    #[serde(default)]
    pub allowances: Option<f64>,
    pub deductions: f64,
    #[serde(default)]
    pub pf: Option<f64>,
    #[serde(default)]
    pub esi: Option<f64>,
    #[serde(default)]
    pub tax: Option<f64>,
    pub gross: f64,
    pub net: f64,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub issued_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePayslipInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub pay_period: Option<String>,
    #[serde(default)]
    pub basic: Option<f64>,
    #[serde(default)]
    pub hra: Option<f64>,
    #[serde(default)]
    pub allowances: Option<f64>,
    #[serde(default)]
    pub deductions: Option<f64>,
    #[serde(default)]
    pub pf: Option<f64>,
    #[serde(default)]
    pub esi: Option<f64>,
    #[serde(default)]
    pub tax: Option<f64>,
    #[serde(default)]
    pub gross: Option<f64>,
    #[serde(default)]
    pub net: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub issued_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayslipResponse {
    pub id: String,
    pub entity: CrmPayslip,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePayslipResponse {
    pub deleted: bool,
}
