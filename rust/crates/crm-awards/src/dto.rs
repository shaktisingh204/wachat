//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::{AwardNomination, AwardWinner, CrmAwardProgram};

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
    pub program_type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProgramInput {
    pub name: String,
    #[serde(default)]
    pub program_type: Option<String>,
    #[serde(default)]
    pub frequency: Option<String>,
    #[serde(default)]
    pub period_start: Option<String>,
    #[serde(default)]
    pub period_end: Option<String>,
    #[serde(default)]
    pub criteria: Option<String>,
    #[serde(default)]
    pub points_value: Option<f64>,
    #[serde(default)]
    pub cash_value: Option<f64>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgramInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub program_type: Option<String>,
    #[serde(default)]
    pub frequency: Option<String>,
    #[serde(default)]
    pub period_start: Option<String>,
    #[serde(default)]
    pub period_end: Option<String>,
    #[serde(default)]
    pub criteria: Option<String>,
    #[serde(default)]
    pub points_value: Option<f64>,
    #[serde(default)]
    pub cash_value: Option<f64>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub nominations: Option<Vec<AwardNomination>>,
    #[serde(default)]
    pub winners: Option<Vec<AwardWinner>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProgramResponse {
    pub id: String,
    pub entity: CrmAwardProgram,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProgramResponse {
    pub deleted: bool,
}
