//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmTimeLog;

/// Query string for the single-document routes (`GET` / `PATCH` /
/// `DELETE /{timeLogId}`). Carries only the SabCRM tenant scope —
/// **required** under `ScopeMode::Project` (the
/// `/v1/sabcrm/people/time-logs` mount), ignored on the legacy mount.
///
/// NOTE the WI-13 exception: the tenant key for time-logs is
/// `tenantProjectId`, NOT `projectId` — `projectId` on this entity is
/// the WORK project FK/filter.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// SabCRM tenant scope (24-char hex `ObjectId`).
    #[serde(default)]
    pub tenant_project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// SabCRM tenant scope — required under `ScopeMode::Project`
    /// (WI-13 exception key; `projectId` below stays the WORK-project
    /// filter).
    #[serde(default)]
    pub tenant_project_id: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub entity_kind: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimeLogInput {
    /// SabCRM tenant scope — required (in the body) under
    /// `ScopeMode::Project` (WI-13 exception key); the `projectId`
    /// field below remains the WORK project FK.
    #[serde(default)]
    pub tenant_project_id: Option<String>,
    #[serde(default)]
    pub user_log_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub issue_id: Option<String>,
    #[serde(default)]
    pub entity_kind: Option<String>,
    #[serde(default)]
    pub entity_id: Option<String>,
    #[serde(default)]
    pub started_at: Option<String>,
    #[serde(default)]
    pub ended_at: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<f64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_billable: Option<bool>,
    #[serde(default)]
    pub hourly_rate: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTimeLogInput {
    #[serde(default)]
    pub user_log_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub issue_id: Option<String>,
    #[serde(default)]
    pub entity_kind: Option<String>,
    #[serde(default)]
    pub entity_id: Option<String>,
    #[serde(default)]
    pub started_at: Option<String>,
    #[serde(default)]
    pub ended_at: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<f64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_billable: Option<bool>,
    #[serde(default)]
    pub hourly_rate: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub approved_by: Option<String>,
    #[serde(default)]
    pub approved_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimeLogResponse {
    pub id: String,
    pub entity: CrmTimeLog,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTimeLogResponse {
    pub deleted: bool,
}
