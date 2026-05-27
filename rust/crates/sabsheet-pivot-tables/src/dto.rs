//! Request / response DTOs for SabSheet pivot tables.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::SabsheetPivotTable;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    pub workbook_id: String,
    #[serde(default)]
    pub sheet_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePivotInput {
    pub sheet_id: String,
    pub workbook_id: String,
    pub name: String,
    pub source_range: String,
    #[serde(default)]
    pub config_json: Option<Document>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePivotInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub source_range: Option<String>,
    #[serde(default)]
    pub config_json: Option<Document>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePivotResponse {
    pub id: String,
    pub entity: SabsheetPivotTable,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabsheetPivotTable>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResponse {
    pub deleted: bool,
}
