//! On-disk shape of a `sabcheckout_integrations` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcheckoutIntegration {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    /// `"day"` | `"week"` | `"month"` | `"year"`.
    pub interval_unit: String,
    /// Count of `interval_unit`s per billing period (e.g. 1 month, 3 months).
    pub interval_count: i32,
    /// Recurring charge per billing period, in minor units.
    pub amount_minor: i64,
    /// ISO 4217 currency, e.g. `"INR"`.
    pub currency: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trial_days: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub setup_fee_minor: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// `"draft"` | `"active"` | `"archived"`.
    #[serde(default = "default_status")]
    pub status: String,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "draft".to_owned()
}
