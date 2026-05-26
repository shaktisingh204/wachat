//! On-disk shape of a `meet_polls` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct PollOption {
    pub id: String,
    pub label: String,
    /// Each voter recorded once (display name or user id string).
    #[serde(default)]
    pub voters: Vec<String>,
    #[serde(default)]
    pub vote_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Poll {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub room_id: ObjectId,

    pub question: String,
    pub options: Vec<PollOption>,

    /// `true` => participants may pick multiple options.
    #[serde(default, skip_serializing_if = "is_false")]
    pub multi_select: bool,
    /// `true` => votes are anonymous; voter ids are not retained.
    #[serde(default, skip_serializing_if = "is_false")]
    pub anonymous: bool,

    /// `"draft"` | `"open"` | `"closed"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
