//! Wire-format DTOs for the SabChat SMS channel adapter.
//!
//! The shim crate (`sabsms-webhooks-inbound` and friends) normalises the
//! provider-specific webhook bodies — Twilio's
//! `application/x-www-form-urlencoded` payload, MSG91's JSON, etc. —
//! into the single envelope shapes defined here, then POSTs them to us.
//! That keeps the SabChat side provider-agnostic.
//!
//! Every body uses `#[serde(rename_all = "camelCase")]` so the wire
//! matches the JSON the shim sends.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// POST /ingest — inbound SMS message
// ---------------------------------------------------------------------------

/// Body for `POST /ingest`. The shim turns whatever the upstream
/// provider sent into this normalised shape; the SMS channel adapter
/// stays provider-agnostic.
///
/// ## Field notes
///
/// - `to` is the **business number** the SMS landed on. We match it
///   against `channelConfig.settings.from_number` on the inbox to locate
///   the right tenant.
/// - `from` is the **visitor's phone number**. Stored digits-only after
///   normalisation so the same human across multiple channel/provider
///   formats merges onto one [`sabchat_types::SabChatContact`].
/// - `providerMessageId` is the provider-side message identifier (Twilio
///   MessageSid, MSG91 messageId, …). Used as the idempotency key.
/// - `provider` discriminates between providers when the same id space
///   could theoretically collide. We persist it on the message row.
/// - `timestamp` is the optional provider-claimed send time (ISO-8601).
///   When absent we stamp wall-clock `now` instead.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestBody {
    /// Business-side number this SMS was sent to. Used to resolve the
    /// SabChat inbox.
    pub to: String,
    /// Visitor-side number that originated the SMS.
    pub from: String,
    /// Plain text body. SMS has no rich content, so we persist a single
    /// [`sabchat_types::ContentBlock::Text`] block.
    pub text: String,
    /// Provider-side message id (Twilio MessageSid, MSG91 messageId, …).
    pub provider_message_id: String,
    /// Provider discriminator (`twilio`, `msg91`, …). Free-form string.
    pub provider: String,
    /// Optional provider-claimed timestamp (ISO-8601). Absent → we
    /// stamp `now`.
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Response body for `POST /ingest`. Returns the new (or replayed)
/// message id alongside the conversation it lives on, so the shim can
/// echo them back to the provider receipt if needed.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestResponse {
    pub message_id: String,
    pub conversation_id: String,
    pub contact_id: String,
    pub inbox_id: String,
    /// `true` when this `providerMessageId` had already been ingested —
    /// signals the shim that no further work is required.
    pub deduplicated: bool,
}

// ---------------------------------------------------------------------------
// POST /status — provider delivery receipt
// ---------------------------------------------------------------------------

/// Body for `POST /status`. Provider delivery receipts (Twilio status
/// callbacks, MSG91 DLR, …) are normalised by the shim into this
/// envelope. We update `providerMetadata.status` on the matching
/// message — no conversation roll-up is touched.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct StatusBody {
    /// Provider-side message id we update by.
    pub provider_message_id: String,
    /// Free-form status string from the provider (`queued`, `sent`,
    /// `delivered`, `failed`, …). We do not coerce — different providers
    /// use different vocabularies and we want the raw value for audits.
    pub status: String,
    /// Optional provider-claimed event timestamp (ISO-8601). Absent →
    /// stamp `now`.
    #[serde(default)]
    pub timestamp: Option<String>,
}

// ---------------------------------------------------------------------------
// Generic success envelope
// ---------------------------------------------------------------------------

/// `{ success: true }` shape returned by terminal endpoints that have
/// nothing to echo back.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SuccessResponse {
    pub success: bool,
}

impl SuccessResponse {
    pub fn ok() -> Self {
        Self { success: true }
    }
}
