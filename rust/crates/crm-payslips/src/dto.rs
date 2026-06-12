//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmPayslip;

/// Query string for the single-document routes (`GET`/`PATCH`/`DELETE
/// /{payslipId}` and `POST /{payslipId}/mark-sent`). Carries only the
/// SabCRM tenant scope — **required** under `ScopeMode::Project` (the
/// `/v1/sabcrm/people/payslips` mount), ignored on the legacy
/// `userId`-scoped mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`). **Required** when
    /// the router is mounted in `ScopeMode::Project`; ignored on the
    /// legacy `userId`-scoped mount.
    #[serde(default)]
    pub project_id: Option<String>,
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
    /// Restrict to payslips generated from one payroll run (rich shape
    /// only — flat payslips carry no `runId`).
    #[serde(default)]
    pub run_id: Option<String>,
    #[serde(default)]
    pub pay_period: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayslipInput {
    /// SabCRM tenant scope. **Required** in `ScopeMode::Project`
    /// (stamped as `projectId`); optional/ignored on the legacy mount.
    #[serde(default)]
    pub project_id: Option<String>,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scope_query_parses_camel_case_project_id() {
        let q: ScopeQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099"
        }))
        .unwrap();
        assert_eq!(q.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));
        let empty: ScopeQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(empty.project_id.is_none());
    }

    #[test]
    fn list_query_parses_run_and_project_filters() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099",
            "runId": "507f1f77bcf86cd799439011",
            "employeeId": "507f1f77bcf86cd799439022",
        }))
        .unwrap();
        assert_eq!(q.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));
        assert_eq!(q.run_id.as_deref(), Some("507f1f77bcf86cd799439011"));
        assert_eq!(q.employee_id.as_deref(), Some("507f1f77bcf86cd799439022"));
    }
}
