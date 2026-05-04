//! Conversation rollup row.
//!
//! There is no first-class `conversations` collection in the current TS
//! implementation — conversation views are derived ad-hoc from
//! `incoming_messages` + `outgoing_messages` (see
//! `src/app/actions/whatsapp.actions.ts::getConversation`). This DTO is the
//! shape the Rust port plans to **materialize** into a `conversations`
//! collection so the inbox/list views don't pay the aggregation cost on
//! every render. Field names mirror the projection that view already
//! computes (`lastMessageTimestamp`, `unreadCount`, `assignedAgentId`),
//! renamed to canonical `last_message_at` / `unread_count` /
//! `assigned_agent` for clarity.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// One conversation between a project and a contact. There is at most one
/// `Conversation` per `(project_id, contact_id)` pair.
///
/// Mongo collection: `conversations` (planned — see module docs).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Conversation {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning project.
    pub project_id: ObjectId,

    /// Counterparty contact. FK into `contacts`.
    pub contact_id: ObjectId,

    /// Timestamp of the most recent message in either direction. Used as
    /// the inbox sort key.
    pub last_message_at: DateTime<Utc>,

    /// How many inbound messages have not been marked read by an agent.
    /// `u32` — a conversation with >4B unread messages is not a real
    /// scenario.
    pub unread_count: u32,

    /// Agent currently assigned to this conversation, if any. `None` =
    /// unassigned (group inbox).
    pub assigned_agent: Option<ObjectId>,
}
