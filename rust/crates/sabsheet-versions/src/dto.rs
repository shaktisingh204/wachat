//! Request / response DTOs for SabSheet versions.

use serde::{Deserialize, Serialize};

use crate::types::SabsheetVersion;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workbook_id: String,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionInput {
    pub workbook_id: String,
    #[serde(default)]
    pub comment: Option<String>,
    /// SabFiles file id holding the dumped snapshot JSON.
    #[serde(default)]
    pub snapshot_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVersionResponse {
    pub id: String,
    pub entity: SabsheetVersion,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsheetVersion>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreVersionInput {
    pub version_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreVersionResponse {
    pub restored: bool,
    pub workbook_id: String,
}
