//! Request DTOs for sabworkerly-jobs.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)] pub page: Option<u32>,
    #[serde(default)] pub limit: Option<u32>,
    #[serde(default)] pub q: Option<String>,
    /// `open | filled | closed | all`. Defaults to `open`.
    #[serde(default)] pub status: Option<String>,
    /// Optional filter by client.
    #[serde(default)] pub client_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobInput {
    pub client_id: String,
    pub title: String,
    #[serde(default)] pub description: Option<String>,
    #[serde(default)] pub skills_required: Vec<String>,
    #[serde(default)] pub shift_pattern: Option<String>,
    pub hourly_charge_rate_minor: i64,
    pub hourly_pay_rate_minor: i64,
    #[serde(default)] pub currency: Option<String>,
    pub start_date: DateTime<Utc>,
    #[serde(default)] pub end_date: Option<DateTime<Utc>>,
    #[serde(default)] pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobInput {
    #[serde(default)] pub client_id: Option<String>,
    #[serde(default)] pub title: Option<String>,
    #[serde(default)] pub description: Option<String>,
    #[serde(default)] pub skills_required: Option<Vec<String>>,
    #[serde(default)] pub shift_pattern: Option<String>,
    #[serde(default)] pub hourly_charge_rate_minor: Option<i64>,
    #[serde(default)] pub hourly_pay_rate_minor: Option<i64>,
    #[serde(default)] pub currency: Option<String>,
    #[serde(default)] pub start_date: Option<DateTime<Utc>>,
    #[serde(default)] pub end_date: Option<DateTime<Utc>>,
    #[serde(default)] pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobResponse {
    pub id: String,
    pub entity: crate::types::SabworkerlyJob,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteJobResponse {
    pub deleted: bool,
}
