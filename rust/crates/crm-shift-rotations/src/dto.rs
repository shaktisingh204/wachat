//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{CrmShiftRotation, RotationDay};

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{rotationId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project` (the
/// `/v1/sabcrm/people/shift-rotations` mount), ignored on the legacy
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
    pub department_id: Option<String>,
    #[serde(default)]
    pub team_id: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRotationInput {
    /// SabCRM tenant scope — required (in the body) under
    /// `ScopeMode::Project`; optional on the legacy user mount.
    #[serde(default)]
    pub project_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub team_id: Option<String>,
    #[serde(default)]
    pub pattern: Option<Vec<RotationDay>>,
    pub cycle_days: i32,
    pub start_date: String,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRotationInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub team_id: Option<String>,
    #[serde(default)]
    pub pattern: Option<Vec<RotationDay>>,
    #[serde(default)]
    pub cycle_days: Option<i32>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRotationResponse {
    pub id: String,
    pub entity: CrmShiftRotation,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRotationResponse {
    pub deleted: bool,
}
