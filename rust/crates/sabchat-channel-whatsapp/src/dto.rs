//! Wire-format DTOs for the SabChat WhatsApp channel-adapter endpoints.
//!
//! The shape mirrors what `wachat-webhook-inbound` already normalises
//! out of a Meta Cloud-API webhook payload — flat top-level fields for
//! the bits we always need (`phoneNumberId`, `waId`, `providerMessageId`)
//! and a tagged `message` block carrying the content kind. The webhook
//! crate forwards exactly this JSON to `POST /ingest`.
//!
//! Every body uses `#[serde(rename_all = "camelCase")]` so the wire
//! shape matches the camelCase JSON the rest of the Next.js side sends.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /ingest`
// ---------------------------------------------------------------------------

/// One normalised inbound WhatsApp message, as forwarded by
/// `wachat-webhook-inbound` after it parses the Meta Cloud-API webhook
/// payload.
///
/// `phoneNumberId` is the Meta business phone-number id (matches
/// `channelConfig.settings.phoneNumberId` on a `whatsapp_cloud` inbox).
/// `waId` is the visitor's WhatsApp id (digits-only E.164, no `+`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestReq {
    /// Meta business phone-number id (string — Meta returns digits but
    /// some scopes return `+`-prefixed values; we treat it as opaque
    /// and compare verbatim against the inbox config).
    pub phone_number_id: String,

    /// Visitor's WhatsApp id (E.164 digits, no `+`).
    pub wa_id: String,

    /// Optional display name from the WhatsApp profile.
    #[serde(default)]
    pub name: Option<String>,

    /// Inbound content. Tagged on `kind` — the wire form matches the
    /// `sabchat_types::ContentBlock` taxonomy but the adapter accepts a
    /// flat shape because that's what the webhook crate already emits.
    pub message: IngestMessage,

    /// Meta's `wamid.*` (or equivalent provider message id). Used for
    /// idempotency — repeat deliveries with the same id are no-ops.
    pub provider_message_id: String,

    /// Optional message timestamp (RFC 3339). Falls back to wall-clock
    /// at insert time if missing.
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Inbound content payload. Tagged-union on `kind` to match the
/// `sabchat_types::ContentBlock` snake_case discriminant scheme. The
/// adapter recognises the kinds Meta's Cloud API actually delivers
/// today; everything else falls back to a text representation.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestMessage {
    /// `text` | `image` | `video` | `audio` | `voice` | `document` |
    /// `sticker` | `location` | `system` | `template` | `interactive`
    /// | …
    pub kind: String,

    /// Plain text body. Populated for `text`, interactive button
    /// replies, and as a caption for media.
    #[serde(default)]
    pub text: Option<String>,

    /// Resolved media URL (already fetched + uploaded to SabFiles by the
    /// webhook crate, ideally). For raw Cloud-API media ids the webhook
    /// crate exchanges them for a download URL before forwarding.
    #[serde(default)]
    pub media_url: Option<String>,

    /// Media MIME type, if known.
    #[serde(default)]
    pub media_mime: Option<String>,

    /// Original file name, if Meta supplied one (document messages).
    #[serde(default)]
    pub media_name: Option<String>,

    /// Media size in bytes, if known.
    #[serde(default)]
    pub media_size: Option<u64>,

    /// SabFiles asset id once the webhook crate has uploaded the media.
    /// Optional — if missing we still write the message but the
    /// `Attachment.sabfile_id` is filled with an empty string for
    /// later reconciliation.
    #[serde(default)]
    pub sabfile_id: Option<String>,

    /// Geo lat/lng (location messages).
    #[serde(default)]
    pub lat: Option<f64>,
    #[serde(default)]
    pub lng: Option<f64>,
    /// Optional human-readable location label.
    #[serde(default)]
    pub label: Option<String>,

    /// Voice clip duration in seconds (voice messages).
    #[serde(default)]
    pub duration_s: Option<u32>,
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
    /// matched an existing message. Lets the webhook crate distinguish
    /// "fresh delivery" from "duplicate webhook retry" in its logs.
    pub deduped: bool,
}

// ---------------------------------------------------------------------------
// `POST /status`
// ---------------------------------------------------------------------------

/// Delivery-receipt payload. WhatsApp Cloud API emits one of these for
/// every outbound message we sent, on each status transition.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StatusReq {
    /// Meta `wamid.*` we stored on the original outbound message.
    pub provider_message_id: String,

    /// `sent` | `delivered` | `read` | `failed`.
    pub status: String,

    /// Optional event timestamp (RFC 3339). Falls back to wall-clock
    /// at write time if missing.
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Response for `POST /status`. `updated == false` means we never wrote
/// (or already saw) this receipt — common on retries from Meta.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StatusResp {
    pub updated: bool,
}
