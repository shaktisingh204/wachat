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
    #[serde(default)]
    pub quarter: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTdsRecordInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    pub employee_name: String,
    pub financial_year: String,
    /// `"Q1"` | `"Q2"` | `"Q3"` | `"Q4"`.
    pub quarter: String,
    #[serde(default)]
    pub tds_amount: f64,
    #[serde(default)]
    pub gross_amount: f64,
    #[serde(default)]
    pub certificate_number: Option<String>,
    #[serde(default)]
    pub deposit_challan_number: Option<String>,
    /// ISO-8601 date string.
    #[serde(default)]
    pub deposit_date: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTdsRecordInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub financial_year: Option<String>,
    #[serde(default)]
    pub quarter: Option<String>,
    #[serde(default)]
    pub tds_amount: Option<f64>,
    #[serde(default)]
    pub gross_amount: Option<f64>,
    #[serde(default)]
    pub certificate_number: Option<String>,
    #[serde(default)]
    pub deposit_challan_number: Option<String>,
    #[serde(default)]
    pub deposit_date: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTdsRecordResponse {
    pub id: String,
    pub entity: crate::types::CrmTdsRecord,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTdsRecordResponse {
    pub deleted: bool,
}

/// Scope carrier for get/update/delete on SabCRM (project) mounts —
/// `?projectId=<oid>`. Ignored on the legacy (`userId`) mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}
