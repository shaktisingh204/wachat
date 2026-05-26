//! On-disk shape of a `sabrewards_referrals` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RewardsReferralConversion {
    pub invitee_id: ObjectId,
    pub converted_at: BsonDateTime,
    /// `"signed_up"` | `"first_purchase"` | `"qualified"`.
    pub kind: String,
    #[serde(default)]
    pub awarded_points: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RewardsReferral {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub member_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub program_id: Option<ObjectId>,

    pub code: String,

    pub shared_at: BsonDateTime,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub conversions: Vec<RewardsReferralConversion>,

    /// Total points already credited to the inviter for this code.
    #[serde(default)]
    pub reward_points: i64,

    #[serde(default)]
    pub active: bool,

    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
