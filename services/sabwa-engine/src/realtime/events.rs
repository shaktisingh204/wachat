//! Typed real-time events published by the SabWa worker.
//!
//! These mirror the event categories enumerated in `SABWA_PLAN.md` §5
//! ("message", "chat", "presence", "qr", "status", "typing") plus a few
//! extras the pairing flow needs (`pair_code`, `message_status`).
//!
//! The enum is serialised with an internal `"kind"` tag and snake_case
//! variant names so the wire format is friendly to a JS/TS consumer:
//!
//! ```json
//! { "kind": "message", "session_id": "…", "chat_jid": "…", "message": { … } }
//! { "kind": "qr",      "session_id": "…", "qr": "2@…" }
//! ```

use serde::{Deserialize, Serialize};

/// Build the Redis pub/sub channel name for a given SabWa session.
///
/// Matches the convention defined in `SABWA_PLAN.md` §5 and §8.
#[must_use]
pub fn channel(session_id: &str) -> String {
    format!("sabwa:{session_id}:events")
}

/// All real-time events that flow worker → server → browser.
///
/// Serialised as a JSON object with an internal `"kind"` discriminator.
/// New variants must be additive — clients ignore unknown `kind` values.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum SabwaEvent {
    /// A new (inbound or outbound) message landed in a chat.
    Message(MessageEvent),
    /// Delivery / read receipt update for a previously-sent message.
    MessageStatus(MessageStatusEvent),
    /// A chat entry was created, updated, archived, pinned, …
    Chat(ChatEvent),
    /// Presence update (online / typing / recording / offline).
    Presence(PresenceEvent),
    /// Typing/recording indicator (granular helper on top of presence).
    Typing(TypingEvent),
    /// A new pairing QR string was emitted during the connect flow.
    Qr(QrEvent),
    /// An 8-character pair code was generated (alternative to QR).
    PairCode(PairCodeEvent),
    /// Session-level lifecycle status (`pending → connected → …`).
    Status(StatusEvent),
}

// ─────────────────────────────────────────────────────────────────────────
//   Payload structs — one per variant for ergonomic construction.
// ─────────────────────────────────────────────────────────────────────────

/// Payload carried by [`SabwaEvent::Message`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MessageEvent {
    /// SabWa session this event belongs to (matches `sabwa_sessions._id`).
    pub session_id: String,
    /// JID of the chat the message appeared in.
    pub chat_jid: String,
    /// The message payload (loosely typed to mirror Mongo doc shape).
    pub message: MessagePayload,
}

/// Loosely-typed message body — full schema lives in `sabwa_messages`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MessagePayload {
    /// Baileys' `key.id`.
    pub message_id: String,
    /// JID of the sender (`fromMe=true` for outbound).
    pub from_jid: String,
    #[serde(default)]
    pub from_me: bool,
    /// `text`, `image`, `audio`, …
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_url: Option<String>,
    /// Unix-ms timestamp.
    pub ts: i64,
}

/// Payload carried by [`SabwaEvent::MessageStatus`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MessageStatusEvent {
    pub session_id: String,
    pub chat_jid: String,
    pub message_id: String,
    /// `sending` | `sent` | `delivered` | `read` | `failed`.
    pub status: String,
    pub ts: i64,
}

/// Payload carried by [`SabwaEvent::Chat`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChatEvent {
    pub session_id: String,
    pub chat: ChatPayload,
}

/// Loosely-typed chat row — full schema lives in `sabwa_chats`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChatPayload {
    pub jid: String,
    /// `individual` | `group` | `broadcast` | `status`.
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default)]
    pub unread_count: u32,
    #[serde(default)]
    pub pinned: bool,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub muted: bool,
    /// Unix-ms timestamp.
    pub updated_at: i64,
}

/// Payload carried by [`SabwaEvent::Presence`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PresenceEvent {
    pub session_id: String,
    pub chat_jid: String,
    /// `available` | `unavailable` | `composing` | `recording` | `paused`.
    pub presence: String,
    /// Unix-ms timestamp.
    pub ts: i64,
}

/// Payload carried by [`SabwaEvent::Typing`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TypingEvent {
    pub session_id: String,
    pub chat_jid: String,
    /// `true` if the peer is currently typing/recording, `false` if stopped.
    pub typing: bool,
    pub ts: i64,
}

/// Payload carried by [`SabwaEvent::Qr`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct QrEvent {
    pub session_id: String,
    /// Raw QR payload (the same string passed to `qrcode` to render).
    pub qr: String,
    /// Unix-ms timestamp of generation.
    pub ts: i64,
}

/// Payload carried by [`SabwaEvent::PairCode`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PairCodeEvent {
    pub session_id: String,
    /// 8-character pair code, formatted as the UI expects (e.g. `JKLM-NPQR`).
    pub code: String,
    pub ts: i64,
}

/// Payload carried by [`SabwaEvent::Status`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StatusEvent {
    pub session_id: String,
    /// `pending` | `connected` | `logged_out` | `banned` | `error`.
    pub status: String,
    /// Optional human-readable detail (error reason, etc.).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub ts: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn channel_format_matches_plan() {
        assert_eq!(channel("abc123"), "sabwa:abc123:events");
    }

    #[test]
    fn message_event_round_trips_with_kind_tag() {
        let ev = SabwaEvent::Message(MessageEvent {
            session_id: "s1".into(),
            chat_jid: "91xxx@s.whatsapp.net".into(),
            message: MessagePayload {
                message_id: "m1".into(),
                from_jid: "91xxx@s.whatsapp.net".into(),
                from_me: false,
                kind: "text".into(),
                body: Some("hi".into()),
                media_url: None,
                ts: 1_700_000_000_000,
            },
        });
        let json = serde_json::to_value(&ev).unwrap();
        assert_eq!(json["kind"], "message");
        let back: SabwaEvent = serde_json::from_value(json).unwrap();
        assert_eq!(back, ev);
    }

    #[test]
    fn qr_event_serialises_as_snake_case() {
        let ev = SabwaEvent::Qr(QrEvent {
            session_id: "s1".into(),
            qr: "2@abc".into(),
            ts: 1,
        });
        let s = serde_json::to_string(&ev).unwrap();
        assert!(s.contains("\"kind\":\"qr\""));
        assert!(s.contains("\"session_id\":\"s1\""));
    }
}
