//! Request DTOs.

use std::collections::BTreeMap;

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
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub period: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewerResponseInput {
    pub reviewer_id: String,
    pub role: String,
    #[serde(default)]
    pub scores: BTreeMap<String, f64>,
    #[serde(default)]
    pub comments: Option<String>,
    #[serde(default)]
    pub submitted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFeedback360Input {
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub period: Option<String>,
    #[serde(default)]
    pub reviewer_ids: Vec<String>,
    #[serde(default)]
    pub reviewer_responses: Vec<ReviewerResponseInput>,
    #[serde(default)]
    pub overall_rating: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFeedback360Input {
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub period: Option<String>,
    #[serde(default)]
    pub reviewer_ids: Option<Vec<String>>,
    #[serde(default)]
    pub reviewer_responses: Option<Vec<ReviewerResponseInput>>,
    #[serde(default)]
    pub overall_rating: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFeedback360Response {
    pub id: String,
    pub entity: crate::types::CrmFeedback360,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFeedback360Response {
    pub deleted: bool,
}
