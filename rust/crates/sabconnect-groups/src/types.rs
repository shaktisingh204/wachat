//! On-disk shape of an `sabconnect_groups` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabConnectGroup {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// `"open"` | `"closed"` | `"secret"`.
    pub visibility: String,

    /// SabFiles file id for the cover image.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_file_id: Option<String>,

    /// Employee user ids (tenant-scoped).
    #[serde(default)]
    pub member_ids: Vec<ObjectId>,

    /// Owner / primary admin (employee id within tenant).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_id: Option<ObjectId>,

    #[serde(default)]
    pub admin_ids: Vec<ObjectId>,

    #[serde(default)]
    pub member_count: i64,

    /// `"active"` | `"archived"`.
    pub status: String,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
