//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmJob;

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
    pub department_id: Option<String>,
    #[serde(default)]
    pub employment_type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobInput {
    pub title: String,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub department_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub responsibilities: Option<String>,
    #[serde(default)]
    pub requirements: Option<String>,
    #[serde(default)]
    pub employment_type: Option<String>,
    #[serde(default)]
    pub experience_min: Option<f64>,
    #[serde(default)]
    pub experience_max: Option<f64>,
    #[serde(default)]
    pub salary_min: Option<f64>,
    #[serde(default)]
    pub salary_max: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub remote_policy: Option<String>,
    #[serde(default)]
    pub openings: Option<i32>,
    #[serde(default)]
    pub hiring_manager_id: Option<String>,
    #[serde(default)]
    pub publish_url: Option<String>,
    #[serde(default)]
    pub publish_at: Option<String>,
    #[serde(default)]
    pub close_at: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJobInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub department_id: Option<String>,
    #[serde(default)]
    pub department_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub responsibilities: Option<String>,
    #[serde(default)]
    pub requirements: Option<String>,
    #[serde(default)]
    pub employment_type: Option<String>,
    #[serde(default)]
    pub experience_min: Option<f64>,
    #[serde(default)]
    pub experience_max: Option<f64>,
    #[serde(default)]
    pub salary_min: Option<f64>,
    #[serde(default)]
    pub salary_max: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub remote_policy: Option<String>,
    #[serde(default)]
    pub openings: Option<i32>,
    #[serde(default)]
    pub filled: Option<i32>,
    #[serde(default)]
    pub hiring_manager_id: Option<String>,
    #[serde(default)]
    pub publish_url: Option<String>,
    #[serde(default)]
    pub publish_at: Option<String>,
    #[serde(default)]
    pub close_at: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobResponse {
    pub id: String,
    pub entity: CrmJob,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteJobResponse {
    pub deleted: bool,
}
