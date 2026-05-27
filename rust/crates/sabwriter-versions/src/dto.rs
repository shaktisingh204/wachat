//! Request / response DTOs for sabwriter-versions.

use serde::{Deserialize, Serialize};

use crate::types::SabwriterDocumentVersion;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub document_id: String,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionInput {
    pub document_id: String,
    pub content_json: serde_json::Value,
    #[serde(default)]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionResponse {
    pub id: String,
    pub entity: SabwriterDocumentVersion,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabwriterDocumentVersion>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}
