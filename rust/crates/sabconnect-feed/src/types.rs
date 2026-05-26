//! On-disk shape of an `sabconnect_feed` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabConnectFeedItem {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Author (employee user id within the tenant).
    pub author_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_avatar_url: Option<String>,

    /// `"post"` | `"announcement"` | `"recognition"` | `"event"`.
    pub kind: String,

    /// Markdown body (rich text) for posts. Other kinds use refId.
    pub body: String,

    /// Attachments — SabFiles file ids (string form). Free-text URLs are
    /// not supported here.
    #[serde(default)]
    pub attachment_ids: Vec<String>,

    /// Optional reference to the originating entity when kind != "post"
    /// (e.g. announcement id, recognition id, event id).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ref_id: Option<ObjectId>,

    /// Optional group scope. If set, the item is shown inside that group.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group_id: Option<ObjectId>,

    /// Pin until this timestamp (overrides chronological sort).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pinned_until: Option<BsonDateTime>,

    #[serde(default)]
    pub reaction_count: i64,
    #[serde(default)]
    pub comment_count: i64,

    #[serde(default)]
    pub tags: Vec<String>,

    /// `"published"` | `"archived"`.
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
