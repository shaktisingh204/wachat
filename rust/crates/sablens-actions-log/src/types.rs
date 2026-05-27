//! On-disk shape of a `sablens_actions_log` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SablensActionLog {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,

    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub session_id: ObjectId,

    pub ts: BsonDateTime,

    /// Actor — `None` means "the customer / guest".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<ObjectId>,

    /// "guest" when the actor is the customer; else "user".
    #[serde(default)]
    pub actor_kind: String,

    /// `"join" | "leave" | "annotate" | "snapshot" | "chat" | "elevate" | "file_transfer"`.
    pub action: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_json: Option<serde_json::Value>,
}
