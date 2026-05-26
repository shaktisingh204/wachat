//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::AgileVelocity;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub project_id: Option<String>,
    /// Limit the last N completed sprints. Default 10, max 50.
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordVelocityInput {
    pub project_id: String,
    pub sprint_id: String,
    pub sprint_name: String,
    pub planned_points: f64,
    pub completed_points: f64,
    /// RFC3339; defaults to now.
    #[serde(default)]
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordVelocityResponse {
    pub id: String,
    pub entity: AgileVelocity,
}
