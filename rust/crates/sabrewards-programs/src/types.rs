//! On-disk shape of a `sabrewards_programs` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RewardsProgram {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Optional reference to an existing `crm_loyalty_programs._id`.
    /// When set, that program's tiers drive tier promotion logic and we
    /// avoid duplicating tier configuration in this entity.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tier_engine_ref: Option<ObjectId>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub points_expire_after_days: Option<i32>,

    /// `"draft"` | `"active"` | `"paused"` | `"archived"`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
