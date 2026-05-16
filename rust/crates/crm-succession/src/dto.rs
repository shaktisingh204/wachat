//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{CrmSuccessionPlan, SuccessionCandidate};

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
    pub readiness_overall: Option<String>,
    #[serde(default)]
    pub critical_role: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlanInput {
    pub role_title: String,
    #[serde(default)]
    pub current_incumbent: Option<String>,
    #[serde(default)]
    pub successors: Option<Vec<SuccessionCandidate>>,
    #[serde(default)]
    pub readiness_overall: Option<String>,
    #[serde(default)]
    pub critical_role: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePlanInput {
    #[serde(default)]
    pub role_title: Option<String>,
    #[serde(default)]
    pub current_incumbent: Option<String>,
    #[serde(default)]
    pub successors: Option<Vec<SuccessionCandidate>>,
    #[serde(default)]
    pub readiness_overall: Option<String>,
    #[serde(default)]
    pub critical_role: Option<bool>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlanResponse {
    pub id: String,
    pub entity: CrmSuccessionPlan,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePlanResponse {
    pub deleted: bool,
}
