//! On-disk shape of a `crm_kb_categories` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmKbCategory {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    pub slug: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    /// Parent node id. `None` means the category is a tree root.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,
    #[serde(default)]
    pub order: i32,

    /// `"internal"` | `"portal"` | `"public"`.
    #[serde(default)]
    pub visibility: String,

    /// Denormalised article count — bumped on article create/archive so
    /// the tree UI can show counts without a per-node aggregation.
    #[serde(default)]
    pub article_count: i64,

    /// `"active"` | `"archived"`.
    #[serde(default)]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
