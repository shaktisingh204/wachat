//! Request DTOs.

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
    #[serde(rename = "type", default)]
    pub survey_type: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurveyQuestionInput {
    pub label: String,
    #[serde(rename = "type")]
    pub question_type: String,
    #[serde(default)]
    pub required: Option<bool>,
    #[serde(default)]
    pub options: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSurveyInput {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "type", default)]
    pub survey_type: Option<String>,
    #[serde(default)]
    pub questions: Vec<SurveyQuestionInput>,
    #[serde(default)]
    pub target_audience: Option<String>,
    #[serde(default)]
    pub audience_ids: Vec<String>,
    #[serde(default)]
    pub anonymous: Option<bool>,
    #[serde(default)]
    pub starts_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub ends_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSurveyInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "type", default)]
    pub survey_type: Option<String>,
    #[serde(default)]
    pub questions: Option<Vec<SurveyQuestionInput>>,
    #[serde(default)]
    pub target_audience: Option<String>,
    #[serde(default)]
    pub audience_ids: Option<Vec<String>>,
    #[serde(default)]
    pub anonymous: Option<bool>,
    #[serde(default)]
    pub starts_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub ends_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub response_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSurveyResponse {
    pub id: String,
    pub entity: crate::types::CrmSurvey,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSurveyResponse {
    pub deleted: bool,
}
