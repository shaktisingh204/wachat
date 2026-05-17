//! Request DTOs.

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
    pub target_audience: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLearningPathInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub target_audience: Option<String>,
    #[serde(default)]
    pub trainings: Vec<String>,
    #[serde(default)]
    pub duration_weeks: Option<i32>,
    #[serde(default)]
    pub is_mandatory: bool,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateLearningPathInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub target_audience: Option<String>,
    #[serde(default)]
    pub trainings: Option<Vec<String>>,
    #[serde(default)]
    pub duration_weeks: Option<i32>,
    #[serde(default)]
    pub is_mandatory: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLearningPathResponse {
    pub id: String,
    pub entity: crate::types::CrmLearningPath,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteLearningPathResponse {
    pub deleted: bool,
}
