//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmCandidate;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"all"` | `"archived"` | stage name | omitted (defaults to non-archived).
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCandidateInput {
    pub first_name: String,
    #[serde(default)]
    pub last_name: Option<String>,
    pub email: String,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub current_company: Option<String>,
    #[serde(default)]
    pub current_title: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub resume_url: Option<String>,
    #[serde(default)]
    pub cover_letter: Option<String>,
    #[serde(default)]
    pub skills: Option<Vec<String>>,
    #[serde(default)]
    pub experience_years: Option<f64>,
    #[serde(default)]
    pub expected_salary: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub rating: Option<i32>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCandidateInput {
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub last_name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub current_company: Option<String>,
    #[serde(default)]
    pub current_title: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub resume_url: Option<String>,
    #[serde(default)]
    pub cover_letter: Option<String>,
    #[serde(default)]
    pub skills: Option<Vec<String>>,
    #[serde(default)]
    pub experience_years: Option<f64>,
    #[serde(default)]
    pub expected_salary: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub rating: Option<i32>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCandidateResponse {
    pub id: String,
    pub entity: CrmCandidate,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCandidateResponse {
    pub deleted: bool,
}
