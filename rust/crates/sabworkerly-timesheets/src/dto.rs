//! Request DTOs for sabworkerly-timesheets.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    /// `draft | submitted | approved | invoiced | rejected | all`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub placement_id: Option<String>,
    #[serde(default)]
    pub worker_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimesheetInput {
    pub placement_id: String,
    pub worker_id: String,
    pub week_start: DateTime<Utc>,
    pub daily_hours_json: JsonValue,
    pub total_hours: f64,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTimesheetInput {
    #[serde(default)]
    pub daily_hours_json: Option<JsonValue>,
    #[serde(default)]
    pub total_hours: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RejectInput {
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimesheetResponse {
    pub id: String,
    pub entity: crate::types::SabworkerlyTimesheet,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTimesheetResponse {
    pub deleted: bool,
}
