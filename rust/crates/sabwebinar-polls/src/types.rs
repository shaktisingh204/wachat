//! On-disk shape of a `sabwebinar_polls` document.

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
    /// Voter handle (display name or join_token); empty when `anonymous`.
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
    pub webinar_id: ObjectId,

    pub question: String,
    pub options: Vec<PollOption>,

    #[serde(default, skip_serializing_if = "is_false")]
    pub anonymous: bool,

    /// `"draft"` | `"open"` | `"closed"`.
    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub opened_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
