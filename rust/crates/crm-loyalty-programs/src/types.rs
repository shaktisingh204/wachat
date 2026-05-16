//! On-disk shape of a `crm_loyalty_programs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LoyaltyTier {
    pub name: String,
    pub threshold: f64,
    pub multiplier: f64,
    #[serde(default)]
    pub perks: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CrmLoyaltyProgram {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub name: String,

    pub points_per_currency_unit: f64,
    pub redemption_ratio: f64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expiry_days: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_redemption_points: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub welcome_bonus: Option<i32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tiers: Vec<LoyaltyTier>,

    /// `"active"` | `"paused"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
