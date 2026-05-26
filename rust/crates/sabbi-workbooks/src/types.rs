//! On-disk shape of a `sabbi_workbooks` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiWorkbook {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Datasets used in this workbook.
    #[serde(default, rename = "datasetIds")]
    pub dataset_ids: Vec<ObjectId>,

    /// Charts authored in this workbook — free-form JSON list. Each entry
    /// is `{ chartId, type, configJson, filtersJson, drilldownJson, ... }`.
    /// Charts may *also* live in `sabbi_charts` for direct addressing — this
    /// field is the workbook's curated list / ordering.
    #[serde(default, rename = "chartsJson")]
    pub charts_json: Vec<Document>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
