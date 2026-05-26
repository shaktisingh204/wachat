//! On-disk shape of a `sabbi_charts` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiChart {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Owning workbook.
    #[serde(rename = "workbookId")]
    pub workbook_id: ObjectId,

    /// Source dataset for this chart.
    #[serde(rename = "datasetId")]
    pub dataset_id: ObjectId,

    pub name: String,

    /// `"bar"` | `"line"` | `"pie"` | `"table"` | `"kpi"` | `"map"` | `"heatmap"`.
    #[serde(rename = "type")]
    pub chart_type: String,

    /// Free-form config — `{ dimensions: [..], measures: [..], aggregation }`.
    #[serde(rename = "configJson")]
    pub config_json: Document,

    /// Filter list — `[{ column, op, value }, …]`.
    #[serde(default, rename = "filtersJson")]
    pub filters_json: Vec<Document>,

    /// Optional drilldown config — `{ targetChartId, paramColumn }`.
    #[serde(default, skip_serializing_if = "Option::is_none", rename = "drilldownJson")]
    pub drilldown_json: Option<Document>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
