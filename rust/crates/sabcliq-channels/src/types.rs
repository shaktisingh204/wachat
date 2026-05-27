//! On-disk shape of a `sabcliq_channels` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcliqChannel {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    /// Workspace owner (tenant root user).
    pub user_id: ObjectId,
    pub workspace_id: ObjectId,

    pub name: String,
    /// `"public"` | `"private"` | `"direct"`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub topic: Option<String>,

    /// User ids that may read & post.
    #[serde(default)]
    pub member_user_ids: Vec<ObjectId>,

    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub pinned: bool,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
