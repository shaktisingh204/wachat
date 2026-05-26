//! On-disk shape of an `sabconnect_comments` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabConnectComment {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Target feed item.
    pub item_id: ObjectId,
    /// Optional parent comment (for threading).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_comment_id: Option<ObjectId>,

    /// Author (employee id within tenant).
    pub author_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_avatar_url: Option<String>,

    pub body: String,

    #[serde(default)]
    pub attachment_ids: Vec<String>,

    #[serde(default)]
    pub edited: bool,

    /// `"active"` | `"deleted"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
