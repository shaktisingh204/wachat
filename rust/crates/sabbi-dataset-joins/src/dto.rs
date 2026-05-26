//! Request DTOs for bi-dataset-joins.

use serde::{Deserialize, Serialize};

use crate::types::{BiDatasetJoin, OnColumn};

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
    pub left_id: Option<String>,
    #[serde(default)]
    pub right_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJoinInput {
    pub name: String,
    pub left_id: String,
    pub right_id: String,
    #[serde(rename = "type", default)]
    pub join_type: Option<String>,
    #[serde(default)]
    pub on_columns: Vec<OnColumn>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJoinInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub left_id: Option<String>,
    #[serde(default)]
    pub right_id: Option<String>,
    #[serde(rename = "type", default)]
    pub join_type: Option<String>,
    #[serde(default)]
    pub on_columns: Option<Vec<OnColumn>>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJoinResponse {
    pub id: String,
    pub entity: BiDatasetJoin,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteJoinResponse {
    pub deleted: bool,
}
