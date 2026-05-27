//! On-disk shape of a `sabcheckout_sessions` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SelectedItem {
    /// Index of the item on the parent SabcheckoutPage at submission time.
    pub item_index: i32,
    /// Snapshot of the item type at session time (`"amount"` | `"plan"`).
    #[serde(rename = "type")]
    pub kind: String,
    pub label: String,
    /// Resolved per-unit amount in minor units (for one-off or plan).
    pub unit_amount_minor: i64,
    pub quantity: i32,
    /// `quantity * unit_amount_minor`.
    pub line_total_minor: i64,
    /// Set when the item references a recurring plan.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_id: Option<ObjectId>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SessionTotals {
    pub subtotal_minor: i64,
    pub total_minor: i64,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabcheckoutSession {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    /// Tenant root — the page owner's user id.
    #[serde(rename = "userId")]
    pub user_id: ObjectId,
    /// Foreign key into `sabcheckout_pages`.
    pub page_id: ObjectId,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payer_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payer_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payer_phone: Option<String>,
    /// Free-form key/value JSON for any custom fields configured on the page.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub custom_fields_json: Option<bson::Document>,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub selected_items: Vec<SelectedItem>,
    pub totals: SessionTotals,

    /// `"pending"` | `"completed"` | `"failed"` | `"expired"`.
    #[serde(default = "default_status")]
    pub status: String,

    /// Opaque id returned by the payment gateway when the session was created.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_session_id: Option<String>,
    /// Opaque payment reference (e.g. Razorpay payment id) on completion.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payment_ref: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<BsonDateTime>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "pending".to_owned()
}
