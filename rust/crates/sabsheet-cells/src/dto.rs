//! Request / response DTOs for SabSheet cells.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::{CellValue, SabsheetCell};

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCellsQuery {
    pub sheet_id: String,
    /// Optional viewport bounds — limits the cell payload to what the grid
    /// is rendering.
    #[serde(default)]
    pub min_row: Option<u32>,
    #[serde(default)]
    pub max_row: Option<u32>,
    #[serde(default)]
    pub min_col: Option<u32>,
    #[serde(default)]
    pub max_col: Option<u32>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetCellInput {
    pub sheet_id: String,
    pub row: u32,
    pub col: u32,
    /// If `valueOrFormula` starts with `=` it is treated as a formula;
    /// otherwise it is stored as a literal value (number if parseable, else
    /// text). `null` clears the cell.
    #[serde(default)]
    pub value_or_formula: Option<String>,
    /// Optional format patch (merged into existing `formatJson`).
    #[serde(default)]
    pub format: Option<Document>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SetCellResponse {
    pub entity: SabsheetCell,
    /// Computed value after applying the formula, if any.
    pub computed: Option<CellValue>,
    /// Cells that may need a refresh because they depend on this cell.
    pub affected: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCellsResponse {
    pub items: Vec<SabsheetCell>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateFormulaInput {
    pub workbook_id: String,
    /// Source string — leading `=` accepted and stripped.
    pub formula: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvaluateFormulaResponse {
    pub display: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecomputeInput {
    pub workbook_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecomputeResponse {
    pub recomputed: u32,
}
