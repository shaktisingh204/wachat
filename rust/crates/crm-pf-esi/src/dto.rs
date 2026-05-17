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
    /// `YYYY-MM`.
    #[serde(default)]
    pub month: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePfEsiRecordInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    pub employee_name: String,
    /// `YYYY-MM`.
    pub month: String,
    #[serde(default)]
    pub pf_employer: f64,
    #[serde(default)]
    pub pf_employee: f64,
    #[serde(default)]
    pub pf_uan: Option<String>,
    #[serde(default)]
    pub esi_employer: f64,
    #[serde(default)]
    pub esi_employee: f64,
    #[serde(default)]
    pub esi_ic_number: Option<String>,
    #[serde(default)]
    pub challan_number: Option<String>,
    /// ISO-8601 date string.
    #[serde(default)]
    pub deposit_date: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePfEsiRecordInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub month: Option<String>,
    #[serde(default)]
    pub pf_employer: Option<f64>,
    #[serde(default)]
    pub pf_employee: Option<f64>,
    #[serde(default)]
    pub pf_uan: Option<String>,
    #[serde(default)]
    pub esi_employer: Option<f64>,
    #[serde(default)]
    pub esi_employee: Option<f64>,
    #[serde(default)]
    pub esi_ic_number: Option<String>,
    #[serde(default)]
    pub challan_number: Option<String>,
    #[serde(default)]
    pub deposit_date: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePfEsiRecordResponse {
    pub id: String,
    pub entity: crate::types::CrmPfEsiRecord,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePfEsiRecordResponse {
    pub deleted: bool,
}
