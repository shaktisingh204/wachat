//! On-disk shape of a `sabbackstage_tickets` document.

use bson::{DateTime as BsonDateTime, oid::ObjectId};
use serde::{Deserialize, Serialize};

/// `"issued"` | `"checked_in"` | `"cancelled"`.
pub type TicketStatusStr = String;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SabbackstageTicket {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    #[serde(rename = "userId")]
    pub user_id: ObjectId,

    /// Ticket-type this seat was issued from.
    pub type_id: ObjectId,
    /// Host event document in `crm_events`.
    pub event_id: ObjectId,
    /// Order that issued the ticket.
    pub order_id: ObjectId,

    pub attendee_name: String,
    pub attendee_email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub attendee_phone: Option<String>,

    /// Opaque scannable code. Unique per issuance. Encoded as the QR
    /// payload on printable tickets.
    pub qr_code: String,

    /// `"issued"` | `"checked_in"` | `"cancelled"`.
    #[serde(default = "default_status")]
    pub status: TicketStatusStr,

    pub issued_at: BsonDateTime,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub checked_in_at: Option<BsonDateTime>,
    /// `userId` of the admin/scanner who marked the ticket in.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub checked_in_by: Option<ObjectId>,

    #[serde(rename = "createdAt")]
    pub created_at: BsonDateTime,
    #[serde(rename = "updatedAt", default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<BsonDateTime>,
}

fn default_status() -> String {
    "issued".to_owned()
}
