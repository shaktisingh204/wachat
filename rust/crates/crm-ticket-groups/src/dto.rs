//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmTicketGroup;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` (default, excludes archived) | `"archived"` | `"all"`.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    /// Filter to groups whose `parentGroupId` equals this id (hex string).
    #[serde(default)]
    pub parent_group_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTicketGroupInput {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub parent_group_id: Option<String>,
    #[serde(default)]
    pub default_assignee_id: Option<String>,
    #[serde(default)]
    pub default_sla_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTicketGroupInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub parent_group_id: Option<String>,
    #[serde(default)]
    pub default_assignee_id: Option<String>,
    #[serde(default)]
    pub default_sla_id: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTicketGroupResponse {
    pub id: String,
    pub entity: CrmTicketGroup,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTicketGroupResponse {
    pub deleted: bool,
}
