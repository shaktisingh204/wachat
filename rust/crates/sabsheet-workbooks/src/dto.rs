//! Request / response DTOs for SabSheet workbooks.

use serde::{Deserialize, Serialize};

use crate::types::SabsheetWorkbook;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    /// `"active"` | `"archived"` | `"all"` | `"active_visible"` (default).
    #[serde(default)]
    pub status: Option<String>,
    /// If `true`, also include workbooks shared with the current user.
    #[serde(default)]
    pub include_shared: Option<bool>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkbookInput {
    pub title: String,
    #[serde(default)]
    pub shared_with_user_ids: Vec<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkbookInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub shared_with_user_ids: Option<Vec<String>>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub default_sheet_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkbookResponse {
    pub id: String,
    pub entity: SabsheetWorkbook,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteWorkbookResponse {
    pub deleted: bool,
}
