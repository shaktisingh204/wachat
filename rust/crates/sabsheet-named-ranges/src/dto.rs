//! Request / response DTOs for SabSheet named ranges.

use serde::{Deserialize, Serialize};

use crate::types::SabsheetNamedRange;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workbook_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNamedRangeInput {
    pub workbook_id: String,
    pub name: String,
    pub sheet_id: String,
    pub start_row: u32,
    pub start_col: u32,
    pub end_row: u32,
    pub end_col: u32,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNamedRangeInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub sheet_id: Option<String>,
    #[serde(default)]
    pub start_row: Option<u32>,
    #[serde(default)]
    pub start_col: Option<u32>,
    #[serde(default)]
    pub end_row: Option<u32>,
    #[serde(default)]
    pub end_col: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateNamedRangeResponse {
    pub id: String,
    pub entity: SabsheetNamedRange,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsheetNamedRange>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}
