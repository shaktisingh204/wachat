//! Shared primitive DTOs used across `api` and `events` modules.
//!
//! Conventions for everything in this file:
//! - All structs derive `Debug, Clone, Serialize, Deserialize`.
//! - Structs serialise with `#[serde(rename_all = "camelCase")]` because the
//!   Next.js consumer is camelCase-native.
//! - Enums serialise with `#[serde(rename_all = "snake_case")]` for their
//!   variants — matches the convention picked in
//!   [`crate::realtime::events`] and described in `SABWA_PLAN.md` §5.
//! - Sum types that carry a discriminant on the wire add
//!   `#[serde(tag = "kind", rename_all = "snake_case")]`.

use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────────────────────────────────
//   Generic envelopes
// ─────────────────────────────────────────────────────────────────────────

/// Cursor-paginated page of items.
///
/// `next_cursor` is `None` when there are no more results. The cursor is an
/// opaque base64 string — clients must not introspect it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    pub items: Vec<T>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

/// Successful response envelope returned from every `/v1/*` endpoint.
///
/// Mirrors the discriminated `{ ok: true, data }` shape the Next.js
/// server actions expect (see `SABWA_PLAN.md` §13).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiOk<T> {
    /// Always `true` for this variant — kept so JSON clients can use a
    /// single `result.ok` discriminator without inspecting status codes.
    pub ok: bool,
    pub data: T,
}

impl<T> ApiOk<T> {
    /// Helper constructor that always sets `ok = true`.
    #[must_use]
    pub fn new(data: T) -> Self {
        Self { ok: true, data }
    }
}

/// Error response envelope.
///
/// `code` is a stable machine-readable string (e.g. `"session_not_found"`,
/// `"permission_denied"`, `"plan_quota_exceeded"`); `error` is a
/// human-readable message safe to surface in the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiErr {
    /// Always `false` for this variant.
    pub ok: bool,
    pub error: String,
    pub code: String,
}

impl ApiErr {
    /// Helper constructor that always sets `ok = false`.
    #[must_use]
    pub fn new(code: impl Into<String>, error: impl Into<String>) -> Self {
        Self {
            ok: false,
            error: error.into(),
            code: code.into(),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//   Primitive aliases
// ─────────────────────────────────────────────────────────────────────────

/// A WhatsApp JID (Jabber-style ID).
///
/// Two forms appear on the wire:
/// - Individual: `"91xxxxxxxxxx@s.whatsapp.net"` — built from the user's
///   E.164 phone number minus the leading `+`.
/// - Group: `"1203...-1709...@g.us"` — the digits before the hyphen are a
///   group creator's phone number; after the hyphen is the creation Unix
///   timestamp in seconds (legacy Baileys format).
///
/// Stored as a plain `String` rather than a newtype so it crosses the FFI
/// to TypeScript without an extra wrapping object.
pub type Jid = String;

// ─────────────────────────────────────────────────────────────────────────
//   Message payload — shared by send / schedule / bulk / events
// ─────────────────────────────────────────────────────────────────────────

/// Polymorphic message payload sent over the wire.
///
/// One struct rather than an enum-per-variant because the Next.js side
/// builds these from a single React form — the discriminator `kind`
/// decides which other fields are required:
///
/// - `Text`     — requires `body`.
/// - `Image` / `Video` / `Audio` / `Voice` / `Document` / `Sticker`
///              — require `media_url` and (usually) `media_mime`.
/// - `Location` / `Contact` / `Poll` — `body` carries a JSON-encoded
///   payload until we shape dedicated DTOs (post-V1).
/// - `Reaction` — `body` carries the emoji, `quoted_message_id` the target.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessagePayloadDto {
    pub kind: MessageKindDto,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,

    /// SabFiles-hosted URL (never an arbitrary external URL — see project
    /// policy in `CLAUDE.md`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_url: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_mime: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,

    /// Baileys `key.id` of the message being replied to or reacted to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quoted_message_id: Option<String>,

    /// JIDs explicitly mentioned in the body (e.g. `@91xxxx`). Used by
    /// Baileys to wire up the `mentionedJid` array.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mentions: Option<Vec<Jid>>,

    /// `Some(true)` for the "@all" group mention shortcut.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mention_all: Option<bool>,
}

/// Discriminator for [`MessagePayloadDto`].
///
/// Variants map 1:1 to the `type` field of `sabwa_messages` documents
/// (see `SABWA_PLAN.md` §3), minus the storage-only `"system"` variant —
/// which is never sent _by_ a client, only received.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MessageKindDto {
    Text,
    Image,
    Video,
    Audio,
    Voice,
    Document,
    Sticker,
    Location,
    Contact,
    Poll,
    Reaction,
}
