//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmInterview;

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
    pub candidate_id: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInterviewInput {
    pub candidate_id: String,
    #[serde(default)]
    pub candidate_name: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub round: Option<i32>,
    #[serde(default)]
    pub round_name: Option<String>,
    #[serde(default)]
    pub interview_type: Option<String>,
    pub scheduled_at: String,
    #[serde(default)]
    pub duration_minutes: Option<i32>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub interviewers: Option<Vec<String>>,
    #[serde(default)]
    pub interviewer_names: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInterviewInput {
    #[serde(default)]
    pub candidate_id: Option<String>,
    #[serde(default)]
    pub candidate_name: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub round: Option<i32>,
    #[serde(default)]
    pub round_name: Option<String>,
    #[serde(default)]
    pub interview_type: Option<String>,
    #[serde(default)]
    pub scheduled_at: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<i32>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub interviewers: Option<Vec<String>>,
    #[serde(default)]
    pub interviewer_names: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub feedback: Option<String>,
    #[serde(default)]
    pub rating: Option<i32>,
    #[serde(default)]
    pub recommendation: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInterviewResponse {
    pub id: String,
    pub entity: CrmInterview,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteInterviewResponse {
    pub deleted: bool,
}
