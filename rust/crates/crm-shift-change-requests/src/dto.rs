//! Request DTOs.
//!
//! Mirrors the on-disk `snake_case` shape (the TS action posts with
//! `snake_case` keys), so we don't apply `rename_all`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{requestId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project` (the
/// `/v1/sabcrm/people/shift-change-requests` mount), ignored on the
/// legacy `userId`-scoped mount. The key stays camelCase (`projectId`)
/// even though this crate's entity wire is snake_case — the tenant key
/// is uniform across the suite.
#[derive(Debug, Clone, Default, Deserialize)]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ListQuery {
    /// SabCRM tenant scope — required under `ScopeMode::Project`.
    #[serde(default, rename = "projectId")]
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
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CreateShiftChangeRequestInput {
    /// SabCRM tenant scope — required (in the body) under
    /// `ScopeMode::Project`; optional on the legacy user mount.
    /// camelCase key on purpose (uniform tenant key).
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    pub current_shift_id: String,
    #[serde(default)]
    pub current_shift_name: Option<String>,
    pub requested_shift_id: String,
    #[serde(default)]
    pub requested_shift_name: Option<String>,
    pub effective_date: DateTime<Utc>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct UpdateShiftChangeRequestInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub current_shift_id: Option<String>,
    #[serde(default)]
    pub current_shift_name: Option<String>,
    #[serde(default)]
    pub requested_shift_id: Option<String>,
    #[serde(default)]
    pub requested_shift_name: Option<String>,
    #[serde(default)]
    pub effective_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
    #[serde(default)]
    pub response_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateShiftChangeRequestResponse {
    pub id: String,
    pub entity: crate::types::CrmShiftChangeRequest,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeleteShiftChangeRequestResponse {
    pub deleted: bool,
}
