//! On-disk shape of `sabmail_folders`.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabmailFolder {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// FK → `sabmail_accounts._id`.
    pub account_id: ObjectId,

    pub name: String,

    /// Tree parent. `None` = root.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<ObjectId>,

    /// `inbox` | `sent` | `drafts` | `trash` | `spam` | `custom`.
    #[serde(rename = "type")]
    pub folder_type: String,

    /// Counts maintained by writes — cheap to keep in sync, expensive to recompute.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unread_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_count: Option<u32>,

    /// `active` | `archived`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
