//! On-disk shape of a `sabshop_tax_rules` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabshopTaxRule {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub storefront_id: ObjectId,
    pub name: String,
    /// ISO country/region code ("IN", "IN-MH", "US-CA"...).
    pub region: String,
    /// Tax rate as a fraction of 1 (0.18 = 18%).
    pub rate: f64,
    /// `true` if the rate is already included in product prices.
    #[serde(default)]
    pub inclusive: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub product_category_ids: Vec<ObjectId>,
    #[serde(default)]
    pub active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
