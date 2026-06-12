//! Request DTOs.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::CrmPayrollSetting;

/// Query string for the single-document routes (`GET`/`PATCH`/`DELETE
/// /{settingId}`, plus the singleton `GET /` + `PUT /` on the project
/// mount). Carries only the SabCRM tenant scope — **required** under
/// `ScopeMode::Project` (the `/v1/sabcrm/people/payroll-settings`
/// mount), ignored on the legacy `userId`-scoped mount.
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
    pub pay_cycle: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSettingInput {
    /// SabCRM tenant scope. **Required** in `ScopeMode::Project`
    /// (stamped as `projectId`); optional/ignored on the legacy mount.
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub company_name: Option<String>,
    #[serde(default)]
    pub pf_rate: Option<f64>,
    #[serde(default)]
    pub esi_rate: Option<f64>,
    #[serde(default)]
    pub pay_cycle: Option<String>,
    #[serde(default)]
    pub tax_slabs: Option<Vec<Document>>,
    #[serde(default)]
    pub default_currency: Option<String>,
}

/// `PUT /` body — the singleton-per-scope upsert (people-suite WI-14).
/// Same field vocabulary as create plus `status`; only the fields
/// explicitly sent are written.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertSettingInput {
    /// SabCRM tenant scope. **Required** in `ScopeMode::Project`.
    /// Also accepted as `?projectId=` on the query string (the body
    /// wins when both are present).
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub company_name: Option<String>,
    #[serde(default)]
    pub pf_rate: Option<f64>,
    #[serde(default)]
    pub esi_rate: Option<f64>,
    #[serde(default)]
    pub pay_cycle: Option<String>,
    #[serde(default)]
    pub tax_slabs: Option<Vec<Document>>,
    #[serde(default)]
    pub default_currency: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSettingInput {
    #[serde(default)]
    pub company_name: Option<String>,
    #[serde(default)]
    pub pf_rate: Option<f64>,
    #[serde(default)]
    pub esi_rate: Option<f64>,
    #[serde(default)]
    pub pay_cycle: Option<String>,
    #[serde(default)]
    pub tax_slabs: Option<Vec<Document>>,
    #[serde(default)]
    pub default_currency: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSettingResponse {
    pub id: String,
    pub entity: CrmPayrollSetting,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSettingResponse {
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
    fn upsert_input_round_trips_camel_case() {
        let input: UpsertSettingInput = serde_json::from_value(serde_json::json!({
            "projectId": "507f1f77bcf86cd799439099",
            "companyName": "Acme Pvt Ltd",
            "pfRate": 12.0,
            "esiRate": 0.75,
            "payCycle": "monthly",
            "taxSlabs": [{ "min": 0, "max": 250000, "rate": 0 }],
            "defaultCurrency": "INR",
            "status": "active",
        }))
        .unwrap();
        assert_eq!(input.project_id.as_deref(), Some("507f1f77bcf86cd799439099"));
        assert_eq!(input.company_name.as_deref(), Some("Acme Pvt Ltd"));
        assert_eq!(input.pf_rate, Some(12.0));
        assert_eq!(input.tax_slabs.as_ref().map(Vec::len), Some(1));
    }
}
