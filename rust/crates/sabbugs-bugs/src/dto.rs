//! Request / response DTOs.

use serde::{Deserialize, Serialize};

use crate::types::Bug;

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
    pub severity: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub reporter_id: Option<String>,
    #[serde(default)]
    pub version_id: Option<String>,
    /// When `true`, returns only bugs assigned to the calling user.
    #[serde(default)]
    pub mine: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBugInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub repro_steps: Option<String>,
    #[serde(default)]
    pub environment: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub reporter_id: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub affected_versions: Option<Vec<String>>,
    #[serde(default)]
    pub fixed_in_version: Option<String>,
    #[serde(default)]
    pub attachment_ids: Option<Vec<String>>,
    #[serde(default)]
    pub labels: Option<Vec<String>>,
    #[serde(default)]
    pub related_bug_ids: Option<Vec<String>>,
    #[serde(default)]
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBugInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub repro_steps: Option<String>,
    #[serde(default)]
    pub environment: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub reporter_id: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub affected_versions: Option<Vec<String>>,
    #[serde(default)]
    pub fixed_in_version: Option<String>,
    #[serde(default)]
    pub attachment_ids: Option<Vec<String>>,
    #[serde(default)]
    pub labels: Option<Vec<String>>,
    #[serde(default)]
    pub related_bug_ids: Option<Vec<String>>,
    #[serde(default)]
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBugResponse {
    pub id: String,
    pub entity: Bug,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteBugResponse {
    pub deleted: bool,
}
