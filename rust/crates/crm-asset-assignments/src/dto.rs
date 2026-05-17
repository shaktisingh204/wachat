//! Request DTOs.

use serde::{Deserialize, Serialize};

use crate::types::CrmAssetAssignment;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"assigned" | "returned" | "lost" | "damaged" | "archived" | "all"`.
    /// Default excludes archived.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetAssignmentInput {
    pub asset_id: String,
    #[serde(default)]
    pub asset_name: Option<String>,
    pub employee_id: String,
    #[serde(default)]
    pub employee_name: Option<String>,
    /// ISO-8601 timestamp. If omitted, defaults to now.
    #[serde(default)]
    pub assigned_at: Option<String>,
    #[serde(default)]
    pub returned_at: Option<String>,
    #[serde(default)]
    pub condition_at_assign: Option<String>,
    #[serde(default)]
    pub condition_at_return: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    /// Defaults to `"assigned"` if absent.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAssetAssignmentInput {
    #[serde(default)]
    pub asset_id: Option<String>,
    #[serde(default)]
    pub asset_name: Option<String>,
    #[serde(default)]
    pub employee_id: Option<String>,
    #[serde(default)]
    pub employee_name: Option<String>,
    #[serde(default)]
    pub assigned_at: Option<String>,
    #[serde(default)]
    pub returned_at: Option<String>,
    #[serde(default)]
    pub condition_at_assign: Option<String>,
    #[serde(default)]
    pub condition_at_return: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssetAssignmentResponse {
    pub id: String,
    pub entity: CrmAssetAssignment,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteAssetAssignmentResponse {
    pub deleted: bool,
}
