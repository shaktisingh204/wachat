//! Request DTOs for bi-datasets.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::BiDataset;

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
    pub source: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatasetInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub source: String,
    #[serde(default)]
    pub file_id: Option<String>,
    #[serde(default)]
    pub collection_name: Option<String>,
    #[serde(default)]
    pub rest_url: Option<String>,
    #[serde(default)]
    pub schema_json: Option<Document>,
    #[serde(default)]
    pub row_count: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDatasetInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub file_id: Option<String>,
    #[serde(default)]
    pub collection_name: Option<String>,
    #[serde(default)]
    pub rest_url: Option<String>,
    #[serde(default)]
    pub schema_json: Option<Document>,
    #[serde(default)]
    pub row_count: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateDatasetResponse {
    pub id: String,
    pub entity: BiDataset,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteDatasetResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResponse {
    /// Sample rows (up to ~50).
    pub rows: Vec<Document>,
    pub row_count: i64,
    pub columns: Vec<String>,
}
