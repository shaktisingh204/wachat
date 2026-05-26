//! On-disk shape of a `meet_qna` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

fn is_false(b: &bool) -> bool {
    !*b
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QnaItem {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub room_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asker_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asker_user_id: Option<ObjectId>,
    pub question: String,

    #[serde(default, skip_serializing_if = "is_false")]
    pub answered: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answered_by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answered_at: Option<BsonDateTime>,

    #[serde(default)]
    pub upvotes: u32,
    /// Display-name / user-id strings that have upvoted (anti double-vote).
    #[serde(default)]
    pub upvoters: Vec<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
