//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{AppraisalKpi, CrmAppraisalReview};

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
    pub period: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReviewInput {
    pub employee_name: String,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub reviewer: Option<String>,
    #[serde(default)]
    pub period: Option<String>,
    #[serde(default)]
    pub kpis: Option<Vec<AppraisalKpi>>,
    #[serde(default)]
    pub overall_rating: Option<f64>,
    #[serde(default)]
    pub comments: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateReviewInput {
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub reviewer: Option<String>,
    #[serde(default)]
    pub period: Option<String>,
    #[serde(default)]
    pub kpis: Option<Vec<AppraisalKpi>>,
    #[serde(default)]
    pub overall_rating: Option<f64>,
    #[serde(default)]
    pub comments: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub finalized_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateReviewResponse {
    pub id: String,
    pub entity: CrmAppraisalReview,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteReviewResponse {
    pub deleted: bool,
}
