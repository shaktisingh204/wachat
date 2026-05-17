//! Request DTOs.
//!
//! Mirrors the on-disk `snake_case` shape (the TS action posts with
//! `snake_case` keys), so we don't apply `rename_all`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Deserialize)]
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
    pub employee_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CreateShiftChangeRequestInput {
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    pub current_shift_id: String,
    #[serde(default)]
    pub current_shift_name: Option<String>,
    pub requested_shift_id: String,
    #[serde(default)]
    pub requested_shift_name: Option<String>,
    pub effective_date: DateTime<Utc>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct UpdateShiftChangeRequestInput {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub current_shift_id: Option<String>,
    #[serde(default)]
    pub current_shift_name: Option<String>,
    #[serde(default)]
    pub requested_shift_id: Option<String>,
    #[serde(default)]
    pub requested_shift_name: Option<String>,
    #[serde(default)]
    pub effective_date: Option<DateTime<Utc>>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub approver_id: Option<String>,
    #[serde(default)]
    pub response_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateShiftChangeRequestResponse {
    pub id: String,
    pub entity: crate::types::CrmShiftChangeRequest,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeleteShiftChangeRequestResponse {
    pub deleted: bool,
}
