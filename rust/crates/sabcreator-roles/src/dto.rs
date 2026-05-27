//! Request DTOs for sabcreator roles.

use serde::{Deserialize, Serialize};

use crate::types::{RowLevelRule, SabcreatorRole};

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
    pub app_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoleInput {
    pub app_id: String,
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub records_can_read: Option<RowLevelRule>,
    #[serde(default)]
    pub records_can_edit: Option<RowLevelRule>,
    #[serde(default)]
    pub records_can_delete: Option<RowLevelRule>,
    #[serde(default)]
    pub forms_can_submit: Option<Vec<String>>,
    #[serde(default)]
    pub pages_can_view: Option<Vec<String>>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRoleInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub records_can_read: Option<RowLevelRule>,
    #[serde(default)]
    pub records_can_edit: Option<RowLevelRule>,
    #[serde(default)]
    pub records_can_delete: Option<RowLevelRule>,
    #[serde(default)]
    pub forms_can_submit: Option<Vec<String>>,
    #[serde(default)]
    pub pages_can_view: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoleResponse {
    pub id: String,
    pub entity: SabcreatorRole,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRoleResponse {
    pub deleted: bool,
}
