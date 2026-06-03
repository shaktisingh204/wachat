//! On-disk shape of a `sabshop_carts` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CartLineItem {
    pub product_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_id: Option<String>,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub image_url: Option<String>,
    pub unit_price: f64,
    pub quantity: u32,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CartTotals {
    pub subtotal: f64,
    #[serde(default)]
    pub tax: f64,
    #[serde(default)]
    pub shipping: f64,
    #[serde(default)]
    pub discount: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabshopCart {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub storefront_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub guest_session_id: Option<String>,
    #[serde(default)]
    pub line_items: Vec<CartLineItem>,
    #[serde(default)]
    pub totals: CartTotals,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub coupon_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<BsonDateTime>,
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}
