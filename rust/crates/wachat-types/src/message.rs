//! Unified message log row.
//!
//! Composes the TS `OutgoingMessage` (line ~2289) and `IncomingMessage`
//! (line ~2313) shapes into a single Rust struct keyed by [`Direction`].
//! TS keeps them in two separate collections (`outgoing_messages` and
//! `incoming_messages`); the wachat Rust handlers reason about them
//! uniformly, so we present one type and let the persistence layer pick
//! the right collection.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Whether this message was sent **out** (us → contact) or received **in**
/// (contact → us). The TS uses the strings `"out"` / `"in"`; we serialize
/// to those exact values for compatibility with existing documents.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    /// Inbound (contact → us). Stored on the TS side as `direction: "in"`.
    #[serde(rename = "in")]
    Inbound,
    /// Outbound (us → contact). Stored on the TS side as `direction: "out"`.
    #[serde(rename = "out")]
    Outbound,
}

/// Lifecycle status of a wachat message.
///
/// `Queued` is a SabNode-internal pre-send state used by the broadcast
/// worker before Meta has acknowledged the request. The remaining four
/// states (`sent`, `delivered`, `read`, `failed`) match Meta's webhook
/// status updates exactly. The TS uses the slightly different value
/// `"pending"` for the pre-send state — we serialize `Queued` as
/// `"pending"` so the wire format stays identical.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    #[serde(rename = "pending")]
    Queued,
    Sent,
    Delivered,
    Read,
    Failed,
}

/// One row in the wachat message log.
///
/// Persisted to either `outgoing_messages` or `incoming_messages` depending
/// on `direction`. Inbound rows leave `broadcast_id` and `status` at their
/// defaults (no broadcast pinning, status irrelevant for inbound) — but the
/// fields are still present so a single index/projection pipeline can read
/// both collections.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageLog {
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning project.
    pub project_id: ObjectId,

    /// Broadcast that produced this message, if any. `None` for 1-1 sends and
    /// for inbound messages.
    pub broadcast_id: Option<ObjectId>,

    /// Counterparty phone in `wa_id` form (digits, no `+`). The TS keeps the
    /// FK as `contactId: ObjectId` rather than denormalizing the phone — we
    /// keep the phone here too because workers and the broadcast log dedup by
    /// phone.
    pub contact_phone: String,

    pub direction: Direction,

    /// For outbound: lifecycle status. For inbound: defaults to `Delivered`
    /// (i.e. "we have it"). Callers should still gate on `direction` before
    /// reasoning about this field.
    pub status: MessageStatus,

    /// Meta `wamid` — the Meta-side unique message id. `None` until Meta
    /// returns it (i.e. for queued outbound messages that haven't been sent
    /// yet, or for failed sends that never got an id).
    pub meta_message_id: Option<String>,

    /// Error string from the last failed attempt. `None` on success.
    pub error: Option<String>,

    pub created_at: DateTime<Utc>,

    /// Set every time `status` transitions. Used by health/analytics queries
    /// to compute "time-to-deliver" / "time-to-read" buckets.
    pub status_updated_at: Option<DateTime<Utc>>,
}
