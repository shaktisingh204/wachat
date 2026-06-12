//! Request DTOs for the Account Group surface.

use serde::{Deserialize, Serialize};

use crate::types::CrmAccountGroup;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"all"` | `"active"` | `"archived"` (defaults to non-archived).
    #[serde(default)]
    pub status: Option<String>,
    /// Filter by accounting nature (asset / liability / income / expense / equity).
    #[serde(default)]
    pub nature: Option<String>,
    /// Filter by parent group id (`"none"` returns top-level groups).
    #[serde(default)]
    pub parent_group_id: Option<String>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupInput {
    pub name: String,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub nature: Option<String>,
    #[serde(default)]
    pub parent_group_id: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    /// SabCRM (project) mounts only — required there, ignored on legacy.
    #[serde(default)]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGroupInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
    #[serde(default)]
    pub nature: Option<String>,
    /// `"none"` (or empty) clears the parent; otherwise a valid ObjectId hex.
    #[serde(default)]
    pub parent_group_id: Option<String>,
    #[serde(default)]
    pub is_active: Option<bool>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupResponse {
    pub id: String,
    pub entity: CrmAccountGroup,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteGroupResponse {
    pub deleted: bool,
}

/// Scope carrier for get/update/delete on SabCRM (project) mounts —
/// `?projectId=<oid>`. Ignored on the legacy (`userId`) mount.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    #[serde(default)]
    pub project_id: Option<String>,
}
