//! Wire-format DTOs for the SabChat LINE channel-adapter endpoints.
//!
//! The wire shape is intentionally flat — LINE's webhook `event` envelope
//! is awkward to forward verbatim (multiple union arms across
//! `message` / `follow` / `postback` / `beacon` / ...), so the webhook
//! shim that lives upstream normalises a LINE event into the small
//! structs here. The shim is responsible for downloading any media file
//! (`image` / `audio`) from the LINE content endpoint and forwarding a
//! public URL — same convention the WhatsApp and Telegram adapters use.
//!
//! Every body uses `#[serde(rename_all = "camelCase")]` to round-trip
//! with the camelCase JSON the Next.js side sends.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /ingest`
// ---------------------------------------------------------------------------

/// One normalised inbound LINE message, as forwarded by the webhook
/// shim after it parses a LINE webhook event of `type == "message"`.
///
/// `channelId` is matched against
/// `channelConfig.settings.channelId` on a `line` inbox (LINE puts the
/// receiving bot's channel id at the root of every webhook payload in
/// the `destination` field — the shim forwards that verbatim).
/// `userId` is LINE's stable per-user id (`source.userId`) and drives
/// the `sabchat_contacts.social_ids` dedupe.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestReq {
    /// LINE bot/official-account channel id (the `destination` field
    /// on the webhook envelope). Compared verbatim against the inbox's
    /// `channelConfig.settings.channelId`.
    pub channel_id: String,

    /// Visitor's LINE user id (`source.userId`). Stable per-user and
    /// drives the per-tenant contact dedupe.
    pub user_id: String,

    /// Optional display name (resolved by the shim via
    /// `/v2/bot/profile/{userId}` if it cared to look it up).
    /// Populates the contact's `name` field on first sighting.
    #[serde(default)]
    pub display_name: Option<String>,

    /// Plain message text. Populated for `type == "text"` events.
    #[serde(default)]
    pub text: Option<String>,

    /// LINE sticker `packageId` (the upstream shim leaves stickers as
    /// metadata-only; we render a placeholder Image block with a
    /// human-readable alt — there's no public CDN URL for stickers).
    #[serde(default)]
    pub sticker_package_id: Option<String>,

    /// LINE sticker `stickerId`. Same caveat as `stickerPackageId`.
    #[serde(default)]
    pub sticker_id: Option<String>,

    /// Resolved image URL (the shim has already downloaded the image
    /// from LINE's content endpoint and re-hosted it).
    #[serde(default)]
    pub image_url: Option<String>,

    /// Resolved audio-clip URL (the shim has already downloaded the
    /// audio from LINE's content endpoint and re-hosted it).
    #[serde(default)]
    pub audio_url: Option<String>,

    /// LINE `message.id` (string-form). Used for idempotency — repeat
    /// deliveries with the same id are no-ops.
    pub provider_message_id: String,

    /// Optional message timestamp (RFC 3339). Falls back to wall-clock
    /// at insert time if missing. LINE forwards `event.timestamp` as
    /// milliseconds since epoch; the shim is expected to convert to
    /// RFC 3339 before forwarding.
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
    /// `true` if this call was a no-op because the `providerMessageId`
    /// matched an existing message. Lets the webhook shim distinguish
    /// "fresh delivery" from "duplicate webhook retry" in its logs.
    #[serde(default)]
    pub deduped: bool,
}

// ---------------------------------------------------------------------------
// `POST /follow`
// ---------------------------------------------------------------------------

/// LINE "user followed the official account" event, as forwarded by
/// the webhook shim.
///
/// LINE delivers `follow` events when a user adds the official account
/// as a friend (or unblocks after a previous block). We treat this as
/// a soft "new contact" signal and append a `System` message to the
/// conversation — creating the contact + conversation if neither
/// existed yet.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FollowReq {
    /// LINE bot/official-account channel id. Same lookup contract as
    /// `IngestReq::channel_id`.
    pub channel_id: String,

    /// Visitor's LINE user id (`source.userId`).
    pub user_id: String,

    /// Optional display name. Populates the contact's `name` field on
    /// first sighting if we hadn't seen one yet.
    #[serde(default)]
    pub display_name: Option<String>,

    /// LINE `webhookEventId` (or any per-event stable id the shim
    /// generates). Used for idempotency — repeat deliveries with the
    /// same id are no-ops.
    pub provider_event_id: String,
}

/// Response for `POST /follow`. `messageId` is the hex id of the
/// `System` message we appended.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FollowResp {
    pub conversation_id: String,
    pub message_id: String,
    /// `true` if this call was a no-op because the `providerEventId`
    /// matched an existing message.
    #[serde(default)]
    pub deduped: bool,
}

// ---------------------------------------------------------------------------
// `POST /postback`
// ---------------------------------------------------------------------------

/// LINE postback payload (a rich-menu / quick-reply / template button
/// tap), as forwarded by the webhook shim.
///
/// LINE postbacks carry a `postback.data` blob the bot author chose
/// when assembling the message. We surface it verbatim on a
/// `System` message — handlers downstream (auto-reply, routing) parse
/// it.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PostbackReq {
    /// LINE bot/official-account channel id. Same lookup contract as
    /// `IngestReq::channel_id`.
    pub channel_id: String,

    /// Visitor's LINE user id (`source.userId`).
    pub user_id: String,

    /// Free-form `postback.data` LINE echoes back from whichever
    /// rich-menu / quick-reply / template button the visitor tapped.
    pub data: String,

    /// LINE `webhookEventId` (or any per-event stable id the shim
    /// generates). Used for idempotency.
    pub provider_event_id: String,
}

/// Response for `POST /postback`. `messageId` is the hex id of the
/// `System` message we appended.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PostbackResp {
    pub conversation_id: String,
    pub message_id: String,
    /// `true` if this call was a no-op because the `providerEventId`
    /// matched an existing message.
    #[serde(default)]
    pub deduped: bool,
}
