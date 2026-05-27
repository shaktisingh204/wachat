use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AdGroupMember {
    /// `"user" | "group"`.
    pub kind: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabopsAdGroup {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub domain_id: ObjectId,

    pub name: String,
    /// `"security" | "distribution"`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub members: Vec<AdGroupMember>,

    pub last_sync_at: BsonDateTime,
}
