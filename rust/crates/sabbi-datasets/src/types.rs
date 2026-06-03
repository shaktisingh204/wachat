//! On-disk shape of a `sabbi_datasets` document.

use bson::{DateTime as BsonDateTime, Document, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiDataset {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"csv_upload"` | `"mongo_collection"` | `"rest_api"`.
    pub source: String,

    /// SabFiles fileId when `source == "csv_upload"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_id: Option<String>,
    /// Mongo collection name when `source == "mongo_collection"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub collection_name: Option<String>,
    /// REST endpoint URL when `source == "rest_api"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rest_url: Option<String>,

    /// Inferred column schema — array of `{ name, type }`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_json: Option<Document>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub row_count: Option<i64>,
    #[serde(
        rename = "lastRefreshAt",
        default,
        skip_serializing_if = "Option::is_none"
    )]
    pub last_refresh_at: Option<BsonDateTime>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
