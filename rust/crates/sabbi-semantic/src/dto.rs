//! Request/response DTOs for sabbi-semantic (models).

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::{BiModel, Dimension, Join, Measure, Segment};

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
    #[serde(default)]
    pub connector: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModelInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub collection: String,
    #[serde(default)]
    pub base_filter: Option<Document>,
    #[serde(default)]
    pub scope_field: Option<String>,
    #[serde(default)]
    pub scope_by: Option<String>,
    #[serde(default)]
    pub scope_string: Option<bool>,
    #[serde(default)]
    pub measures: Option<Vec<Measure>>,
    #[serde(default)]
    pub dimensions: Option<Vec<Dimension>>,
    #[serde(default)]
    pub joins: Option<Vec<Join>>,
    #[serde(default)]
    pub segments: Option<Vec<Segment>>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub connector: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateModelInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub collection: Option<String>,
    #[serde(default)]
    pub base_filter: Option<Document>,
    #[serde(default)]
    pub scope_field: Option<String>,
    #[serde(default)]
    pub scope_by: Option<String>,
    #[serde(default)]
    pub scope_string: Option<bool>,
    #[serde(default)]
    pub measures: Option<Vec<Measure>>,
    #[serde(default)]
    pub dimensions: Option<Vec<Dimension>>,
    #[serde(default)]
    pub joins: Option<Vec<Join>>,
    #[serde(default)]
    pub segments: Option<Vec<Segment>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModelResponse {
    pub id: String,
    pub entity: BiModel,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteModelResponse {
    pub deleted: bool,
}
