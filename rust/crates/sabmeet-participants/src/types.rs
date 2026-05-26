//! On-disk shape of a `meet_participants` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Participant {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub room_id: ObjectId,

    /// Authenticated participant — references SabNode `users._id`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub participant_user_id: Option<ObjectId>,
    /// Guest participant — no account.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guest_email: Option<String>,
    pub display_name: String,

    /// `"host"` | `"cohost"` | `"participant"` | `"viewer"`.
    pub role: String,

    pub joined_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_at: Option<BsonDateTime>,
    /// Convenience derived field — written on leave.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ip: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
