//! Request DTOs.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

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
    pub client_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEngagementInput {
    pub client_id: String,
    pub name: String,
    #[serde(default)]
    pub scope_json: Option<JsonValue>,
    pub start_date: chrono::DateTime<chrono::Utc>,
    #[serde(default)]
    pub end_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub hourly_rate_minor: Option<i64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub billing_cadence: Option<String>,
    #[serde(default)]
    pub assigned_user_ids: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateEngagementInput {
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub scope_json: Option<JsonValue>,
    #[serde(default)]
    pub start_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub end_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub hourly_rate_minor: Option<i64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub billing_cadence: Option<String>,
    #[serde(default)]
    pub assigned_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEngagementResponse {
    pub id: String,
    pub entity: crate::types::SabPracticeEngagement,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEngagementResponse {
    pub deleted: bool,
}
