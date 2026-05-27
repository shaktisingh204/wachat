//! On-disk shape of a `sabcheckout_subscriptions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcheckoutSubscription {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub plan_id: ObjectId,
    pub customer_id: ObjectId,

    /// `"active"` | `"past_due"` | `"paused"` | `"cancelled"`.
    #[serde(default = "default_status")]
    pub status: String,
    pub current_period_start: BsonDateTime,
    pub current_period_end: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cancelled_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "active".to_owned()
}
