//! Request DTOs.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub task_id: Option<String>,
    #[serde(default)]
    pub engagement_id: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub logger_user_id: Option<String>,
    #[serde(default)]
    pub from: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub to: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub billable: Option<bool>,
    #[serde(default)]
    pub unbilled_only: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimeLogInput {
    pub task_id: String,
    #[serde(default)]
    pub engagement_id: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    pub logger_user_id: String,
    pub date: chrono::DateTime<chrono::Utc>,
    pub hours: f64,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub billable: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTimeLogInput {
    #[serde(default)]
    pub date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub hours: Option<f64>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub billable: Option<bool>,
    #[serde(default)]
    pub billed_invoice_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTimeLogResponse {
    pub id: String,
    pub entity: crate::types::SabPracticeTimeLog,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTimeLogResponse {
    pub deleted: bool,
}
