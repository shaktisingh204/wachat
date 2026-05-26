//! On-disk shape of a `sabbi_dataset_joins` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OnColumn {
    pub left: String,
    pub right: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BiDatasetJoin {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(rename = "leftId")]
    pub left_id: ObjectId,
    #[serde(rename = "rightId")]
    pub right_id: ObjectId,

    /// `"inner"` | `"left"` | `"right"` | `"outer"`.
    #[serde(rename = "type")]
    pub join_type: String,

    /// Column mappings between left + right tables.
    #[serde(default)]
    pub on_columns: Vec<OnColumn>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
