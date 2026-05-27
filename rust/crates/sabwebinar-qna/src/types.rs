//! On-disk shape of a `sabwebinar_qna` document.

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
    pub webinar_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asker_name: Option<String>,

    pub question: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
    #[serde(default, skip_serializing_if = "is_false")]
    pub answered: bool,

    #[serde(default)]
    pub upvotes: u32,
    /// Voter handles (display names or join_tokens) that already upvoted.
    #[serde(default)]
    pub upvoters: Vec<String>,

    pub created_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub answered_at: Option<BsonDateTime>,
}
