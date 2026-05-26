//! On-disk shape of a `sabrewards_redemptions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RewardsRedemption {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub member_id: ObjectId,
    pub catalog_item_id: ObjectId,

    pub points: i64,

    /// `"pending"` | `"fulfilled"` | `"cancelled"`.
    pub status: String,

    pub redeemed_at: BsonDateTime,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fulfilled_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancelled_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
