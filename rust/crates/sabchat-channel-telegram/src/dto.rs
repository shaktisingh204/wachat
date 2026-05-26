//! Wire-format DTOs for the SabChat Telegram channel-adapter endpoints.
//!
//! The wire shape is intentionally flat — Telegram's `Update` envelope
//! is awkward to forward verbatim (lots of optional union arms), so the
//! webhook shim that lives upstream normalises a Telegram update into
//! the small struct here. The shim is responsible for downloading any
//! media file (`photo` / `voice`) from the Telegram CDN and forwarding
//! a public URL — same convention the WhatsApp adapter uses.
//!
//! Every body uses `#[serde(rename_all = "camelCase")]` to round-trip
//! with the camelCase JSON the Next.js side sends.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /ingest`
// ---------------------------------------------------------------------------

/// One normalised inbound Telegram message, as forwarded by the webhook
/// shim after it parses Telegram's `Update` envelope.
///
/// `botUsername` is matched against
/// `channelConfig.settings.botUsername` on a `telegram` inbox. `chatId`
/// is Telegram's chat id (an integer in their schema; we accept it as
/// a string to side-step JS number-precision issues on the shim side).
/// `fromId` is the visitor's Telegram user id and drives the
/// `sabchat_contacts.social_ids` dedupe.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestReq {
    /// Bot's `@username` without the leading `@`. Compared verbatim
    /// against the inbox's `channelConfig.settings.botUsername`.
    pub bot_username: String,

    /// Telegram chat id (string-form to avoid JS precision loss).
    pub chat_id: String,

    /// Visitor's Telegram user id (string-form). Stable per-user across
    /// chats and drives the per-tenant contact dedupe.
    pub from_id: String,

    /// Optional Telegram `@username` of the sender (no leading `@`).
    /// Stored on the contact's [`SocialIdentity.handle`] when present.
    ///
    /// [`SocialIdentity.handle`]: sabchat_types::SocialIdentity
    #[serde(default)]
    pub from_username: Option<String>,

    /// Optional display name (Telegram `first_name + last_name`).
    /// Populates the contact's `name` field on first sighting.
    #[serde(default)]
    pub from_name: Option<String>,

    /// Plain message text. Populated for text messages and as a caption
    /// for media.
    #[serde(default)]
    pub text: Option<String>,

    /// Resolved photo URL (the shim has already downloaded the largest
    /// photo size from Telegram and re-hosted it).
    #[serde(default)]
    pub photo_url: Option<String>,

    /// Resolved voice-clip URL (the shim has already downloaded the OGG
    /// from Telegram and re-hosted it).
    #[serde(default)]
    pub voice_url: Option<String>,

    /// Voice clip duration in seconds. Required when `voiceUrl` is set;
    /// we default to 0 if missing so the schema stays permissive.
    #[serde(default)]
    pub voice_duration_s: Option<u32>,

    /// Telegram `update.update_id` (string-form). Used for idempotency
    /// — repeat deliveries with the same id are no-ops.
    pub provider_update_id: String,

    /// Optional message timestamp (RFC 3339). Falls back to wall-clock
    /// at insert time if missing.
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Response for `POST /ingest`. Returns the (created or reused)
/// conversation id and the freshly inserted (or pre-existing on
/// idempotent retry) message id, both as hex `ObjectId` strings.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestResp {
    pub conversation_id: String,
    pub message_id: String,
    /// `true` if this call was a no-op because the `providerUpdateId`
    /// matched an existing message. Lets the webhook shim distinguish
    /// "fresh delivery" from "duplicate webhook retry" in its logs.
    #[serde(default)]
    pub deduped: bool,
}

// ---------------------------------------------------------------------------
// `POST /callback`
// ---------------------------------------------------------------------------

/// Telegram callback-query (inline-keyboard button press) payload, as
/// forwarded by the webhook shim.
///
/// Telegram callback queries don't carry a `chat_id` reliably (the
/// origin chat is implicit in the original message), so we look up the
/// most-recent open conversation for the `(inbox, contact)` pair and
/// append the press there. If no conversation exists we return 404 —
/// a stray callback for a never-conversed contact is almost certainly
/// a stale message ID and we'd rather surface it than silently spawn.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CallbackReq {
    /// Bot's `@username` without the leading `@`. Same lookup contract
    /// as `IngestReq::bot_username`.
    pub bot_username: String,

    /// Visitor's Telegram user id (string-form).
    pub from_id: String,

    /// Free-form `callback_data` Telegram echoes back from whichever
    /// inline button the visitor tapped. Surfaced in the system note
    /// verbatim — handlers downstream (auto-reply, routing) parse it.
    pub data: String,

    /// Telegram `callback_query.id` (string-form). Used for idempotency
    /// — repeat deliveries with the same id are no-ops.
    pub provider_update_id: String,
}

/// Response for `POST /callback`. `messageId` is the hex id of the
/// `System` message we appended.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CallbackResp {
    pub conversation_id: String,
    pub message_id: String,
    /// `true` if this call was a no-op because the `providerUpdateId`
    /// matched an existing message.
    #[serde(default)]
    pub deduped: bool,
}
