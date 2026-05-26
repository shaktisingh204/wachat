//! On-disk shape of an `sabconnect_manuals` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabConnectManual {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,
    pub slug: String,
    /// Markdown body.
    pub body: String,

    /// Optional group scope.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_id: Option<ObjectId>,
    /// Optional parent page for tree-style manuals.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    #[serde(default)]
    pub published: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,

    /// Monotonic version counter. Increments on body change.
    #[serde(default)]
    pub version: i64,

    #[serde(default)]
    pub tags: Vec<String>,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
