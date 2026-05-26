//! On-disk shape of a `sabrewards_catalog` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RewardsCatalogItem {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub program_id: Option<ObjectId>,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// SabFiles file id. SabNode policy forbids free-text URLs for files,
    /// so the canonical reference is the SabFiles document id and the URL
    /// is derived server-side on render.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_file_id: Option<String>,

    pub points_cost: i64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stock: Option<i64>,

    #[serde(default)]
    pub active: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
