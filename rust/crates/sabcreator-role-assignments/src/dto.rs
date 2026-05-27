//! Request DTOs for sabcreator role assignments.

use serde::{Deserialize, Serialize};

use crate::types::SabcreatorRoleAssignment;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub app_id: Option<String>,
    #[serde(default)]
    pub assignee_user_id: Option<String>,
    #[serde(default)]
    pub role_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssignmentInput {
    pub app_id: String,
    pub assignee_user_id: String,
    pub role_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssignmentResponse {
    pub id: String,
    pub entity: SabcreatorRoleAssignment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAssignmentResponse {
    pub deleted: bool,
}
