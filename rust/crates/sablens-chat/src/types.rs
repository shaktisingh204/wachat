//! On-disk shape of a `sablens_chat` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SablensChatMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub session_id: ObjectId,

    pub ts: BsonDateTime,

    /// `None` when sender is the customer guest.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sender_user_id: Option<ObjectId>,

    /// "guest" | "user".
    #[serde(default)]
    pub sender_kind: String,

    pub body: String,

    /// SabFiles fileIds for any attachments on this message.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub attachment_ids: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
