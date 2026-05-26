//! Request DTOs for bi-schedules.

use serde::{Deserialize, Serialize};

use crate::types::BiSchedule;

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
    pub workbook_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScheduleInput {
    pub name: String,
    pub workbook_id: String,
    pub cron: String,
    #[serde(default)]
    pub recipients: Vec<String>,
    pub format: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateScheduleInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub cron: Option<String>,
    #[serde(default)]
    pub recipients: Option<Vec<String>>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateScheduleResponse {
    pub id: String,
    pub entity: BiSchedule,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteScheduleResponse {
    pub deleted: bool,
}
