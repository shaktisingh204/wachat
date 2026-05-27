use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabopsAgentToken {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub token: String,
    pub expires_at: BsonDateTime,
    #[serde(default)]
    pub used: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub used_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub redeemed_endpoint_id: Option<ObjectId>,
    /// `"windows" | "macos" | "linux" | "ios" | "android"` — optional hint.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub intended_os: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
}
