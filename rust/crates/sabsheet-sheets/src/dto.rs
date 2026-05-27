//! Request / response DTOs for SabSheet sheets.

use serde::{Deserialize, Serialize};

use crate::types::SabsheetSheet;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workbook_id: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSheetInput {
    pub workbook_id: String,
    pub name: String,
    #[serde(default)]
    pub position: Option<u32>,
    #[serde(default)]
    pub row_count: Option<u32>,
    #[serde(default)]
    pub col_count: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSheetInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub position: Option<u32>,
    #[serde(default)]
    pub row_count: Option<u32>,
    #[serde(default)]
    pub col_count: Option<u32>,
    #[serde(default)]
    pub frozen_rows: Option<u32>,
    #[serde(default)]
    pub frozen_cols: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSheetResponse {
    pub id: String,
    pub entity: SabsheetSheet,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsheetSheet>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSheetResponse {
    pub deleted: bool,
}
