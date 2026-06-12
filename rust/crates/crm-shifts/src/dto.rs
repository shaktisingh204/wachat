//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmShift;

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{shiftId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project` (the
/// `/v1/sabcrm/people/shifts` mount), ignored on the legacy
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
    pub is_active: Option<bool>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub department_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShiftInput {
    /// SabCRM tenant scope — required (in the body) under
    /// `ScopeMode::Project`; optional on the legacy user mount.
    #[serde(default)]
    pub project_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub code: Option<String>,
    pub start_time: String,
    pub end_time: String,
    #[serde(default)]
    pub break_minutes: Option<i32>,
    #[serde(default)]
    pub grace_minutes: Option<i32>,
    #[serde(default)]
    pub is_night_shift: Option<bool>,
    #[serde(default)]
    pub working_days: Option<Vec<String>>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub department_ids: Option<Vec<String>>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateShiftInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub start_time: Option<String>,
    #[serde(default)]
    pub end_time: Option<String>,
    #[serde(default)]
    pub break_minutes: Option<i32>,
    #[serde(default)]
    pub grace_minutes: Option<i32>,
    #[serde(default)]
    pub is_night_shift: Option<bool>,
    #[serde(default)]
    pub working_days: Option<Vec<String>>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub department_ids: Option<Vec<String>>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShiftResponse {
    pub id: String,
    pub entity: CrmShift,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteShiftResponse {
    pub deleted: bool,
}
