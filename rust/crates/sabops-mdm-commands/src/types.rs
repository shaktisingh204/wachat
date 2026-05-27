use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabopsMdmCommand {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub endpoint_id: ObjectId,

    /// `"lock" | "wipe" | "locate" | "install_app" | "reboot" | "sync_settings"`.
    pub kind: String,
    /// `"queued" | "sent" | "acknowledged" | "failed"`.
    pub status: String,
    #[serde(default, skip_serializing_if = "Value::is_null")]
    pub payload_json: Value,

    pub issued_by: String,
    pub issued_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acked_at: Option<BsonDateTime>,
}
