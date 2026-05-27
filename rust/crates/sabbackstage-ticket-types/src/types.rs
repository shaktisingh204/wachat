//! On-disk shape of a `sabbackstage_ticket_types` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// `"draft"` | `"live"` | `"paused"` | `"soldout"`.
pub type TicketTypeStatusStr = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabbackstageTicketType {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Refs the existing `crm_events._id` — the host event document.
    pub event_id: ObjectId,

    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Price in minor currency units (paise / cents).
    #[serde(default)]
    pub price_minor: i64,
    /// ISO 4217 currency code, e.g. `"INR"`, `"USD"`.
    #[serde(default = "default_currency")]
    pub currency: String,

    /// Total available seats. `0` means unlimited.
    #[serde(default)]
    pub capacity: i64,
    /// Seats already issued (incremented atomically on ticket issuance).
    #[serde(default)]
    pub sold_count: i64,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sales_start_at: Option<BsonDateTime>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sales_end_at: Option<BsonDateTime>,

    /// `"draft"` | `"live"` | `"paused"` | `"soldout"`.
    #[serde(default = "default_status")]
    pub status: TicketTypeStatusStr,

    /// Display order on the public page (ascending).
    #[serde(default)]
    pub order_rank: i32,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_currency() -> String {
    "INR".to_owned()
}
fn default_status() -> String {
    "draft".to_owned()
}
