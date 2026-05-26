//! On-disk shape of a `sabrewards_members` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RewardsMember {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub program_id: ObjectId,
    pub customer_id: ObjectId,

    #[serde(default)]
    pub current_points: i64,
    #[serde(default)]
    pub lifetime_points: i64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_tier: Option<String>,

    pub joined_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
