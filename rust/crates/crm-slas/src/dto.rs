//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmSla;

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
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSlaInput {
    pub name: String,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub channel: Option<String>,
    pub first_response_minutes: i64,
    pub resolution_minutes: i64,
    #[serde(default)]
    pub business_hours_only: Option<bool>,
    #[serde(default)]
    pub escalate_to: Option<String>,
    #[serde(default)]
    pub escalate_after_minutes: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSlaInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub severity: Option<String>,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub first_response_minutes: Option<i64>,
    #[serde(default)]
    pub resolution_minutes: Option<i64>,
    #[serde(default)]
    pub business_hours_only: Option<bool>,
    #[serde(default)]
    pub escalate_to: Option<String>,
    #[serde(default)]
    pub escalate_after_minutes: Option<i64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSlaResponse {
    pub id: String,
    pub entity: CrmSla,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSlaResponse {
    pub deleted: bool,
}
