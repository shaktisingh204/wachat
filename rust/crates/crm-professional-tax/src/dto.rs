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
    pub state: Option<String>,
    /// `YYYY-MM`.
    #[serde(default)]
    pub month: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfessionalTaxRecordInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    pub employee_name: String,
    pub state: String,
    /// `YYYY-MM`.
    pub month: String,
    #[serde(default)]
    pub gross_salary: f64,
    #[serde(default)]
    pub pt_amount: f64,
    /// Optional caller-resolved slab descriptor.
    #[serde(default)]
    pub slab_applied: Option<String>,
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
pub struct UpdateProfessionalTaxRecordInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub state: Option<String>,
    #[serde(default)]
    pub month: Option<String>,
    #[serde(default)]
    pub gross_salary: Option<f64>,
    #[serde(default)]
    pub pt_amount: Option<f64>,
    #[serde(default)]
    pub slab_applied: Option<String>,
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
pub struct CreateProfessionalTaxRecordResponse {
    pub id: String,
    pub entity: crate::types::CrmProfessionalTaxRecord,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProfessionalTaxRecordResponse {
    pub deleted: bool,
}
