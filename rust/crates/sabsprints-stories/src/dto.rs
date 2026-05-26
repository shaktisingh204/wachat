//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::SabsprintsStory;

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
    pub project_id: Option<String>,
    #[serde(default)]
    pub sprint_id: Option<String>,
    #[serde(default)]
    pub epic_id: Option<String>,
    /// Pass "null" to request stories with no sprint assigned (backlog).
    #[serde(default)]
    pub sprint_filter: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStoryInput {
    pub project_id: String,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub sprint_id: Option<String>,
    #[serde(default)]
    pub epic_id: Option<String>,
    #[serde(default)]
    pub points: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Option<Vec<String>>,
    #[serde(default)]
    pub rank: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStoryInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    /// Pass an empty string `""` to detach from sprint (move to backlog).
    #[serde(default)]
    pub sprint_id: Option<String>,
    #[serde(default)]
    pub epic_id: Option<String>,
    #[serde(default)]
    pub points: Option<f64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub assignee_id: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Option<Vec<String>>,
    #[serde(default)]
    pub rank: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderEntry {
    pub id: String,
    pub rank: f64,
}

/// Batch reorder for backlog drag/drop.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderInput {
    pub items: Vec<ReorderEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateStoryResponse {
    pub id: String,
    pub entity: SabsprintsStory,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteStoryResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderResponse {
    pub updated: u64,
}
