//! Request DTOs for bi-charts.

use bson::Document;
use serde::{Deserialize, Serialize};

use crate::types::BiChart;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
    #[serde(default)]
    pub q: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub workbook_id: Option<String>,
    #[serde(default)]
    pub dataset_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChartInput {
    pub name: String,
    pub workbook_id: String,
    pub dataset_id: String,
    #[serde(rename = "type")]
    pub chart_type: String,
    #[serde(default)]
    pub config_json: Option<Document>,
    #[serde(default)]
    pub filters_json: Vec<Document>,
    #[serde(default)]
    pub drilldown_json: Option<Document>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChartInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub dataset_id: Option<String>,
    #[serde(rename = "type", default)]
    pub chart_type: Option<String>,
    #[serde(default)]
    pub config_json: Option<Document>,
    #[serde(default)]
    pub filters_json: Option<Vec<Document>>,
    #[serde(default)]
    pub drilldown_json: Option<Document>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChartResponse {
    pub id: String,
    pub entity: BiChart,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteChartResponse {
    pub deleted: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunChartInput {
    /// Drilldown filters layered on top of saved filters.
    #[serde(default)]
    pub extra_filters: Vec<Document>,
    /// Hard cap on returned rows (default 1000, max 5000).
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunChartResponse {
    /// Aggregated rows. Each row is `{ <dimensions...>, <measureKey>: number, ... }`.
    pub rows: Vec<Document>,
    /// Column metadata returned to the renderer.
    pub columns: Vec<ChartColumn>,
    /// `"renderable"` (we computed it) | `"raw"` (renderer must handle) | `"unsupported"`.
    pub mode: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartColumn {
    pub key: String,
    /// `"dimension"` | `"measure"`.
    pub role: String,
    /// `"string"` | `"number"` | `"date"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
}
