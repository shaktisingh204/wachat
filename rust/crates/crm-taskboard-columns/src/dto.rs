//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmTaskboardColumn;

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
    pub board_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateColumnInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub board_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub display_order: Option<i32>,
    #[serde(default)]
    pub wip_limit: Option<i32>,
    #[serde(default)]
    pub default_status: Option<String>,
    #[serde(default)]
    pub is_collapsed: Option<bool>,
    #[serde(default)]
    pub is_done_column: Option<bool>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateColumnInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub board_id: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub display_order: Option<i32>,
    #[serde(default)]
    pub wip_limit: Option<i32>,
    #[serde(default)]
    pub default_status: Option<String>,
    #[serde(default)]
    pub is_collapsed: Option<bool>,
    #[serde(default)]
    pub is_done_column: Option<bool>,
    #[serde(default)]
    pub tasks_count: Option<i64>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateColumnResponse {
    pub id: String,
    pub entity: CrmTaskboardColumn,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteColumnResponse {
    pub deleted: bool,
}
