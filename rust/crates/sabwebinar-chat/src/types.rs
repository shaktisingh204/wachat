//! On-disk shape of a `sabwebinar_chat` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub webinar_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<ObjectId>,

    pub sender_name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sender_user_id: Option<ObjectId>,

    pub body: String,
    pub ts: BsonDateTime,
}
