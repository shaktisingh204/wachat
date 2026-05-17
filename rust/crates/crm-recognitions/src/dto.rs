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
    pub category: Option<String>,
    #[serde(default)]
    pub is_public: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecognitionInput {
    #[serde(default)]
    pub from_employee_id: Option<String>,
    #[serde(default)]
    pub from_employee_name: Option<String>,
    #[serde(default)]
    pub to_employee_id: Option<String>,
    pub to_employee_name: String,
    #[serde(default)]
    pub category: Option<String>,
    pub message: String,
    #[serde(default)]
    pub badge_url: Option<String>,
    #[serde(default)]
    pub points: Option<i32>,
    #[serde(default)]
    pub is_public: Option<bool>,
    #[serde(default)]
    pub award_program_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecognitionInput {
    #[serde(default)]
    pub from_employee_id: Option<String>,
    #[serde(default)]
    pub from_employee_name: Option<String>,
    #[serde(default)]
    pub to_employee_id: Option<String>,
    #[serde(default)]
    pub to_employee_name: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub badge_url: Option<String>,
    #[serde(default)]
    pub points: Option<i32>,
    #[serde(default)]
    pub is_public: Option<bool>,
    #[serde(default)]
    pub award_program_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecognitionResponse {
    pub id: String,
    pub entity: crate::types::CrmRecognition,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRecognitionResponse {
    pub deleted: bool,
}
