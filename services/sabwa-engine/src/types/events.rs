//! API-facing real-time event payloads.
//!
//! These DTOs mirror the variants of [`crate::realtime::events::SabwaEvent`]
//! but are slightly richer / better shaped for direct consumption by the
//! Next.js SSE client:
//!
//! - `MessageDto` includes `status` and `reactions` (which the worker
//!   carries internally but the realtime crate keeps loosely typed).
//! - Timestamps are surfaced as `expires_at` for time-bound events
//!   (QR / pair code) so the browser can drop the artifact at the right
//!   moment without re-deriving from `ts + ttl`.
//!
//! See `SABWA_PLAN.md` §5 for the channel layout. The on-the-wire
//! discriminator (`{ "kind": "message", … }`) is owned by `SabwaEvent`
//! itself — these structs are the inner payloads.

use serde::{Deserialize, Serialize};

use super::common::{Jid, MessagePayloadDto};

// ─────────────────────────────────────────────────────────────────────────
//   Message events
// ─────────────────────────────────────────────────────────────────────────

/// Payload sent when a new message lands in a chat (inbound or outbound).
///
/// Surfaces the chat JID alongside the message so the SSE client can route
/// the event to the right chat panel without an extra lookup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageEventPayload {
    pub session_id: String,
    pub chat_jid: Jid,
    pub message: MessageDto,
}

/// Wire-format representation of a single message row.
///
/// Sourced from `sabwa_messages` but with `ObjectId`s collapsed to
/// `String`, and timestamps as Unix-ms `i64` to match what the Baileys
/// store emits.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageDto {
    /// Baileys' `key.id`.
    pub id: String,
    pub from_jid: Jid,
    pub from_me: bool,
    /// Unix-ms timestamp.
    pub ts: i64,
    pub payload: MessagePayloadDto,
    /// `sending` | `sent` | `delivered` | `read` | `failed`.
    pub status: String,
    #[serde(default)]
    pub reactions: Vec<ReactionDto>,
}

/// Single reaction on a message — `(jid, emoji, ts)`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReactionDto {
    pub jid: Jid,
    pub emoji: String,
    /// Unix-ms timestamp the reaction was registered.
    pub ts: i64,
}

// ─────────────────────────────────────────────────────────────────────────
//   Presence / typing
// ─────────────────────────────────────────────────────────────────────────

/// Presence update for a peer in a chat.
///
/// `kind` is one of `available` | `unavailable` | `composing` |
/// `recording` | `paused` (Baileys vocabulary).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PresenceEventPayload {
    pub session_id: String,
    pub chat_jid: Jid,
    pub kind: String,
}

// ─────────────────────────────────────────────────────────────────────────
//   Pairing flow events
// ─────────────────────────────────────────────────────────────────────────

/// A new pairing QR string was emitted.
///
/// The browser should render the QR until `expires_at` (Unix-ms) elapses;
/// Baileys cycles a fresh QR every ~30s during pairing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QrEventPayload {
    pub session_id: String,
    pub qr: String,
    /// Unix-ms timestamp after which this QR is no longer valid.
    pub expires_at: i64,
}

/// An 8-character pair code was issued (alternative to QR scan).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairCodeEventPayload {
    pub session_id: String,
    /// Display-formatted pair code, e.g. `"JKLM-NPQR"`.
    pub code: String,
    /// Unix-ms timestamp after which this code is no longer valid.
    pub expires_at: i64,
}

// ─────────────────────────────────────────────────────────────────────────
//   Session lifecycle
// ─────────────────────────────────────────────────────────────────────────

/// Session-level lifecycle status change.
///
/// `status` mirrors `sabwa_sessions.status` (`pending` | `connected` |
/// `logged_out` | `banned` | `error`); `detail` carries the human reason
/// for failure states.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusEventPayload {
    pub session_id: String,
    pub status: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}
