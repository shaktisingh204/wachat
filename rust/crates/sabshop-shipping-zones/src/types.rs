//! On-disk shape of a `sabshop_shipping_zones` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShippingRate {
    pub name: String,
    /// `"flat"` | `"per_kg"` | `"free"`.
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub flat_price: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub per_kg: Option<f64>,
    /// Free over this cart total.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_total: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabshopShippingZone {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub storefront_id: ObjectId,
    pub name: String,
    /// ISO country codes or region tags ("IN-MH", "US", ...).
    #[serde(default)]
    pub regions: Vec<String>,
    #[serde(default)]
    pub rates: Vec<ShippingRate>,
    #[serde(default)]
    pub active: bool,
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
