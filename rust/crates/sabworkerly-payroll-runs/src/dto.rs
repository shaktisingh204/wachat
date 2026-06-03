//! Request DTOs for sabworkerly-payroll-runs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayrollLineInput {
    pub worker_id: String,
    pub hours: f64,
    pub rate: i64,
    pub amount_minor: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayrollRunInput {
    pub period_start: DateTime<Utc>,
    pub period_end: DateTime<Utc>,
    #[serde(default)]
    pub timesheet_ids: Vec<String>,
    #[serde(default)]
    pub line_items: Vec<CreatePayrollLineInput>,
    pub total_minor: i64,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePayrollRunInput {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub processed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePayrollRunResponse {
    pub id: String,
    pub entity: crate::types::SabworkerlyPayrollRun,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePayrollRunResponse {
    pub deleted: bool,
}
