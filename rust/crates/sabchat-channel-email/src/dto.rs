//! Wire-format DTOs for the SabChat email channel endpoints.
//!
//! Mirrors the normalised JSON the upstream poller / webhook shim
//! produces — every field is `#[serde(rename_all = "camelCase")]` so
//! the on-the-wire payload stays uniform with the rest of the SabChat
//! HTTP surface.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// POST /v1/sabchat/channels/email/ingest
// ---------------------------------------------------------------------------

/// One inbound attachment row. The upstream shim is responsible for
/// uploading raw MIME parts to SabFiles and forwarding only the
/// resolved metadata here; we never stream bytes.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestAttachment {
    /// Resolved URL (SabFiles share link or pre-signed R2 URL).
    pub url: String,
    /// Original file name.
    pub name: String,
    /// MIME type, best effort.
    #[serde(default)]
    pub mime: Option<String>,
    /// Size in bytes, if known.
    #[serde(default)]
    pub size: Option<u64>,
    /// SabFiles asset id, if the upstream shim has already uploaded the
    /// part. Falls back to a synthesised id derived from `url` when not
    /// supplied.
    #[serde(default)]
    pub sabfile_id: Option<String>,
}

/// Body for `POST /v1/sabchat/channels/email/ingest`. All optional
/// fields are documented inline; only `to`, `from`, and `messageId` are
/// strictly required (the threading + idempotency contract collapses
/// without them).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestEmailBody {
    /// Recipient address. Matched verbatim against
    /// `sabchat_inboxes.channelConfig.settings.address` (case-insensitive)
    /// to resolve the owning tenant + inbox.
    pub to: String,

    /// Sender address. Resolved-or-created as a `SabChatContact` under
    /// the inbox's tenant.
    pub from: String,

    /// Optional display name extracted from the `From:` header, used as
    /// the contact's `name` when we create a fresh contact.
    #[serde(default)]
    pub from_name: Option<String>,

    /// Subject of the email; used as the conversation title when we
    /// create a brand new conversation, and prepended to the
    /// `ContentBlock::Text` body for readability in the agent inbox.
    #[serde(default)]
    pub subject: Option<String>,

    /// Plain-text body. Preferred over `htmlBody` when both are present.
    #[serde(default)]
    pub text_body: Option<String>,

    /// HTML body. We strip tags into plain text if `textBody` is empty.
    #[serde(default)]
    pub html_body: Option<String>,

    /// RFC-2822 `Message-ID` (without surrounding angle brackets is
    /// fine; we strip them defensively). Used both for threading and
    /// for idempotency on retried inbound deliveries.
    pub message_id: String,

    /// RFC-2822 `In-Reply-To` header value of the inbound message, if
    /// any. We strip angle brackets and feed it into the threading
    /// lookup alongside `references`.
    #[serde(default)]
    pub in_reply_to: Option<String>,

    /// RFC-2822 `References` header, parsed by the upstream shim into a
    /// list of bare `Message-ID` strings (no angle brackets).
    #[serde(default)]
    pub references: Vec<String>,

    /// Pre-resolved attachments lifted off the inbound MIME by the
    /// upstream shim. Each attachment becomes a `ContentBlock::File`
    /// message appended after the textual body, so the agent inbox can
    /// render them inline.
    #[serde(default)]
    pub attachments: Vec<IngestAttachment>,

    /// Wall-clock the inbound provider stamped on the message. RFC-3339
    /// preferred but anything `chrono::DateTime::parse_from_rfc3339`
    /// accepts is fine. Falls back to `Utc::now()` when absent / unparseable.
    #[serde(default)]
    pub timestamp: Option<String>,
}

/// Response envelope for `POST /v1/sabchat/channels/email/ingest`.
///
/// `idempotent` is `true` when the inbound `messageId` already mapped
/// to a stored message; the response then reflects the existing row
/// and no new writes were performed.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestEmailResponse {
    pub ok: bool,
    /// Whether the inbound was a duplicate of a previously stored row.
    pub idempotent: bool,
    /// Whether a brand new conversation was created (vs. attached).
    pub new_conversation: bool,
    /// Hex `_id` of the owning inbox.
    pub inbox_id: String,
    /// Hex `_id` of the resolved/created contact.
    pub contact_id: String,
    /// Hex `_id` of the owning conversation.
    pub conversation_id: String,
    /// Hex `_id` of the (new or existing) message row.
    pub message_id: String,
}
