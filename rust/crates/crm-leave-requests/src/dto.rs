//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmLeaveRequest;

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{requestId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project`, ignored on the legacy
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
    /// SabCRM tenant scope — required under `ScopeMode::Project`.
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
    #[serde(default)]
    pub leave_type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLeaveRequestInput {
    /// SabCRM tenant scope — required (in the body) under
    /// `ScopeMode::Project`; optional on the legacy user mount.
    #[serde(default)]
    pub project_id: Option<String>,
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub leave_type: Option<String>,
    #[serde(default)]
    pub leave_type_id: Option<String>,
    /// RFC3339 / ISO-8601 date or datetime.
    pub start_date: String,
    /// RFC3339 / ISO-8601 date or datetime.
    pub end_date: String,
    /// Number of leave days. Must be > 0.
    pub days: f64,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub comments: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLeaveRequestInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub leave_type: Option<String>,
    #[serde(default)]
    pub leave_type_id: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub days: Option<f64>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
    #[serde(default)]
    pub approved_at: Option<String>,
    #[serde(default)]
    pub comments: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLeaveRequestResponse {
    pub id: String,
    pub entity: CrmLeaveRequest,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteLeaveRequestResponse {
    pub deleted: bool,
}
