//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::RequestedFile;

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
    pub client_id: Option<String>,
    #[serde(default)]
    pub engagement_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocRequestInput {
    pub client_id: String,
    #[serde(default)]
    pub engagement_id: Option<String>,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub requested_files: Vec<RequestedFile>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocRequestInput {
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub engagement_id: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub due_date: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub requested_files: Option<Vec<RequestedFile>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocRequestResponse {
    pub id: String,
    pub entity: crate::types::SabPracticeDocumentRequest,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDocRequestResponse {
    pub deleted: bool,
}
