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
    pub kind: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub from: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub to: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeadlineInput {
    pub client_id: String,
    #[serde(default)]
    pub engagement_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub kind: Option<String>,
    pub due_date: chrono::DateTime<chrono::Utc>,
    #[serde(default)]
    pub recurrence: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub assigned_user_id: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub attachment_file_ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDeadlineInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub recurrence: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub assigned_user_id: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub attachment_file_ids: Option<Vec<String>>,
    #[serde(default)]
    pub engagement_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDeadlineInput {
    #[serde(default)]
    pub attachment_file_ids: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDeadlineResponse {
    pub id: String,
    pub entity: crate::types::SabPracticeDeadline,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDeadlineResponse {
    pub deleted: bool,
}
