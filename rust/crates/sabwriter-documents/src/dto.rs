//! Request / response DTOs for sabwriter-documents.

use serde::{Deserialize, Serialize};

use crate::types::{DocumentStatus, SabwriterDocument};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `draft | in_review | approved | sent_for_signature | shared | all`
    #[serde(default)]
    pub status: Option<String>,
    /// When `true`, include documents shared with the current user (not
    /// just owned). Default `true`.
    #[serde(default)]
    pub include_shared: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentInput {
    pub title: String,
    #[serde(default)]
    pub content_json: Option<serde_json::Value>,
    #[serde(default)]
    pub shared_with_user_ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDocumentInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub content_json: Option<serde_json::Value>,
    #[serde(default)]
    pub status: Option<DocumentStatus>,
    #[serde(default)]
    pub shared_with_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub envelope_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDocumentResponse {
    pub id: String,
    pub entity: SabwriterDocument,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDocumentResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabwriterDocument>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareInput {
    pub user_ids: Vec<String>,
}
