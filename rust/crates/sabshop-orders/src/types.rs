//! On-disk shape of a `sabshop_orders` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderLineItem {
    pub product_id: ObjectId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub variant_id: Option<String>,
    pub name: String,
    pub unit_price: f64,
    pub quantity: u32,
    pub line_total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrderTotals {
    pub subtotal: f64,
    #[serde(default)] pub tax: f64,
    #[serde(default)] pub shipping: f64,
    #[serde(default)] pub discount: f64,
    pub total: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrderAddress {
    #[serde(default, skip_serializing_if = "Option::is_none")] pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub phone: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub line1: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub line2: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub city: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub state: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub postal_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")] pub country: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SabshopOrder {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    pub storefront_id: ObjectId,
    pub order_code: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub customer_id: Option<ObjectId>,
    pub line_items: Vec<OrderLineItem>,
    pub totals: OrderTotals,
    /// `"unpaid"` | `"paid"` | `"refunded"` | `"failed"`.
    #[serde(default = "default_payment")]
    pub payment_status: String,
    /// `"unfulfilled"` | `"processing"` | `"shipped"` | `"delivered"` | `"cancelled"`.
    #[serde(default = "default_fulfill")]
    pub fulfillment_status: String,
    #[serde(default)]
    pub shipping_address: OrderAddress,
    #[serde(default)]
    pub billing_address: OrderAddress,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_payment() -> String { "unpaid".into() }
fn default_fulfill() -> String { "unfulfilled".into() }
