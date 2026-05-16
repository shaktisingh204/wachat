//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmExit;

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
    pub r#type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExitInput {
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub notice_start: Option<String>,
    #[serde(default)]
    pub last_day: Option<String>,
    #[serde(default)]
    pub fnf_status: Option<String>,
    #[serde(default)]
    pub noc_status: Option<String>,
    #[serde(default)]
    pub asset_return_status: Option<String>,
    #[serde(default)]
    pub knowledge_transfer_status: Option<String>,
    #[serde(default)]
    pub exit_interview_notes: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExitInput {
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub notice_start: Option<String>,
    #[serde(default)]
    pub last_day: Option<String>,
    #[serde(default)]
    pub fnf_status: Option<String>,
    #[serde(default)]
    pub noc_status: Option<String>,
    #[serde(default)]
    pub asset_return_status: Option<String>,
    #[serde(default)]
    pub knowledge_transfer_status: Option<String>,
    #[serde(default)]
    pub exit_interview_notes: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateExitResponse {
    pub id: String,
    pub entity: CrmExit,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteExitResponse {
    pub deleted: bool,
}
