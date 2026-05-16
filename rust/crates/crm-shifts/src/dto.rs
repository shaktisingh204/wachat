//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmShift;

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
    pub is_active: Option<bool>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub department_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShiftInput {
    pub name: String,
    #[serde(default)]
    pub code: Option<String>,
    pub start_time: String,
    pub end_time: String,
    #[serde(default)]
    pub break_minutes: Option<i32>,
    #[serde(default)]
    pub grace_minutes: Option<i32>,
    #[serde(default)]
    pub is_night_shift: Option<bool>,
    #[serde(default)]
    pub working_days: Option<Vec<String>>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub department_ids: Option<Vec<String>>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateShiftInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub start_time: Option<String>,
    #[serde(default)]
    pub end_time: Option<String>,
    #[serde(default)]
    pub break_minutes: Option<i32>,
    #[serde(default)]
    pub grace_minutes: Option<i32>,
    #[serde(default)]
    pub is_night_shift: Option<bool>,
    #[serde(default)]
    pub working_days: Option<Vec<String>>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub is_default: Option<bool>,
    #[serde(default)]
    pub department_ids: Option<Vec<String>>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateShiftResponse {
    pub id: String,
    pub entity: CrmShift,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteShiftResponse {
    pub deleted: bool,
}
