//! On-disk shape of a `crm_announcements` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmAnnouncement {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub title: String,
    pub body: String,

    /// `"general"` | `"hr"` | `"policy"` | `"event"` | `"celebration"` | `"urgent"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,

    /// `"low"` | `"normal"` | `"high"` | `"urgent"`.
    pub priority: String,

    /// `"all"` | `"department"` | `"team"` | `"role"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audience: Option<String>,

    #[serde(default)]
    pub audience_ids: Vec<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub publish_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<BsonDateTime>,

    #[serde(default)]
    pub pinned: bool,

    #[serde(default = "default_true")]
    pub allow_comments: bool,

    #[serde(default)]
    pub require_acknowledgement: bool,

    #[serde(default)]
    pub acknowledgement_count: i64,

    #[serde(default)]
    pub view_count: i64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub banner_url: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_name: Option<String>,

    /// `"draft"` | `"scheduled"` | `"published"` | `"archived"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub published_at: Option<BsonDateTime>,

    #[serde(default)]
    pub tags: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
