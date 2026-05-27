//! Request DTOs for sabworkerly-placements.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)] pub page: Option<u32>,
    #[serde(default)] pub limit: Option<u32>,
    #[serde(default)] pub status: Option<String>,
    #[serde(default)] pub job_id: Option<String>,
    #[serde(default)] pub worker_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlacementInput {
    pub job_id: String,
    pub worker_id: String,
    pub start_date: DateTime<Utc>,
    #[serde(default)] pub end_date: Option<DateTime<Utc>>,
    pub hourly_charge_rate_minor: i64,
    pub hourly_pay_rate_minor: i64,
    #[serde(default)] pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlacementInput {
    #[serde(default)] pub end_date: Option<DateTime<Utc>>,
    #[serde(default)] pub hourly_charge_rate_minor: Option<i64>,
    #[serde(default)] pub hourly_pay_rate_minor: Option<i64>,
    #[serde(default)] pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlacementResponse {
    pub id: String,
    pub entity: crate::types::SabworkerlyPlacement,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePlacementResponse {
    pub deleted: bool,
}
