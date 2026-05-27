//! On-disk shape of a `sabbackstage_orders` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// `"pending"` | `"paid"` | `"failed"` | `"refunded"`.
pub type OrderStatusStr = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OrderItem {
    pub type_id: ObjectId,
    pub qty: i32,
    pub price_minor: i64,
    /// Snapshot of the ticket-type display name at order time.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct OrderTotals {
    pub subtotal_minor: i64,
    #[serde(default)]
    pub tax_minor: i64,
    #[serde(default)]
    pub discount_minor: i64,
    pub total_minor: i64,
    #[serde(default = "default_currency")]
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabbackstageOrder {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Host event in `crm_events`.
    pub event_id: ObjectId,

    pub buyer_name: String,
    pub buyer_email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer_phone: Option<String>,

    pub items: Vec<OrderItem>,
    pub totals: OrderTotals,

    /// `"pending"` | `"paid"` | `"failed"` | `"refunded"`.
    #[serde(default = "default_status")]
    pub status: OrderStatusStr,

    /// Opaque gateway reference once the payment confirms.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_currency() -> String {
    "INR".to_owned()
}
fn default_status() -> String {
    "pending".to_owned()
}
