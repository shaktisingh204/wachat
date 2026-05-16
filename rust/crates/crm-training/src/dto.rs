//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmTraining;

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
    pub training_type: Option<String>,
    #[serde(default)]
    pub is_mandatory: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTrainingInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub training_type: Option<String>,
    #[serde(default)]
    pub delivery_mode: Option<String>,
    #[serde(default)]
    pub trainer_name: Option<String>,
    #[serde(default)]
    pub trainer_id: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub duration_hours: Option<f64>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub max_participants: Option<i32>,
    #[serde(default)]
    pub cost_per_person: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub certification_provided: Option<bool>,
    #[serde(default)]
    pub materials_url: Option<String>,
    #[serde(default)]
    pub is_mandatory: Option<bool>,
    #[serde(default)]
    pub department_ids: Option<Vec<String>>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTrainingInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub training_type: Option<String>,
    #[serde(default)]
    pub delivery_mode: Option<String>,
    #[serde(default)]
    pub trainer_name: Option<String>,
    #[serde(default)]
    pub trainer_id: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub duration_hours: Option<f64>,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub max_participants: Option<i32>,
    #[serde(default)]
    pub enrolled: Option<i32>,
    #[serde(default)]
    pub completed: Option<i32>,
    #[serde(default)]
    pub cost_per_person: Option<f64>,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub certification_provided: Option<bool>,
    #[serde(default)]
    pub materials_url: Option<String>,
    #[serde(default)]
    pub is_mandatory: Option<bool>,
    #[serde(default)]
    pub department_ids: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTrainingResponse {
    pub id: String,
    pub entity: CrmTraining,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTrainingResponse {
    pub deleted: bool,
}
