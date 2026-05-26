//! Wire-format DTOs for the SabChat Facebook channel ingest endpoints.
//!
//! Both bodies mirror the normalised JSON the Next.js webhook shim
//! emits after stripping Meta's wrapper envelope (`object: "page"`,
//! `entry[]`, `messaging[]` / `changes[]`). Every field uses
//! `#[serde(rename_all = "camelCase")]` to match the shim's JSON.
//!
//! Response shapes are intentionally tiny — the orchestrator only needs
//! to know "did we accept it?" plus the resolved SabChat ids so the
//! shim can ack the Meta delivery and emit websocket events.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /ingest` — Messenger DM
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/channels/facebook/ingest`.
///
/// One normalised Messenger event. The shim flattens Meta's webhook
/// envelope (one entry per page, one messaging item per delivery) into
/// this shape so the Rust side never has to know about
/// `entry[].messaging[]` plumbing.
///
/// `text` and `attachmentUrl` are both optional — Messenger allows
/// attachment-only deliveries (image, audio, file). At least one of the
/// two must be present; we reject the empty case with `422`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MessengerIngestBody {
    /// Facebook Page id the message arrived at. Used to locate the
    /// owning SabChat inbox via
    /// `channel_config.settings.page_id == pageId`.
    pub page_id: String,

    /// Facebook page-scoped sender id (PSID). Stored on the resolved
    /// `SabChatContact.socialIds[]` entry as `external_id`.
    pub sender_id: String,

    /// Optional display name lifted from Meta's `from.name` or a follow
    /// -up Graph profile fetch. We persist it on the contact's `name`
    /// field if the contact had none.
    #[serde(default)]
    pub sender_name: Option<String>,

    /// Plain-text body. Optional — attachment-only messages send
    /// `attachmentUrl` instead.
    #[serde(default)]
    pub text: Option<String>,

    /// Optional CDN URL of an inline attachment (image, audio, file).
    /// We persist it as a `ContentBlock::Image` when the MIME starts
    /// with `image/`, otherwise as `ContentBlock::File`.
    #[serde(default)]
    pub attachment_url: Option<String>,

    /// MIME type of the attachment, when known. Drives the
    /// content-block kind selection.
    #[serde(default)]
    pub attachment_mime: Option<String>,

    /// Meta's `mid` for the inbound message. Used as the idempotency
    /// key on `sabchat_messages.providerMetadata.dedupeKey`.
    pub provider_message_id: String,

    /// Original delivery wall-clock from Meta, if the shim forwarded
    /// it. Defaults to "now" when absent.
    #[serde(default)]
    pub timestamp: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// `POST /comment` — Page comment
// ---------------------------------------------------------------------------

/// Body for `POST /v1/sabchat/channels/facebook/comment`.
///
/// One normalised Facebook Page comment event. We model the comment as
/// a `ContentBlock::Card` so the agent UI renders a citation-style row
/// linking to the post the comment was left on — this matches the
/// Instagram channel adapter (`sabchat-channel-instagram`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CommentIngestBody {
    /// Facebook Page id the comment was left on.
    pub page_id: String,

    /// Page-scoped commenter id (PSID).
    pub sender_id: String,

    /// Post id the comment is on. Rendered into the Card's subtitle
    /// and link button so agents can jump to context.
    pub post_id: String,

    /// Meta's comment id — also our idempotency key.
    pub comment_id: String,

    /// The comment body. Comments are always text on the wire (any
    /// attached image lives on the parent post, not the comment).
    pub text: String,

    /// Original delivery wall-clock from Meta, if the shim forwarded
    /// it.
    #[serde(default)]
    pub timestamp: Option<DateTime<Utc>>,
}

// ---------------------------------------------------------------------------
// Shared response envelope
// ---------------------------------------------------------------------------

/// Response envelope for both ingest endpoints.
///
/// `created` is `false` when the event was deduped against an existing
/// `providerMetadata.dedupeKey` — the shim treats both cases as
/// success, but observability cares about the distinction.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestResponse {
    pub ok: bool,
    pub created: bool,
    /// Hex string of the resolved `sabchat_messages._id`.
    pub message_id: String,
    /// Hex string of the resolved `sabchat_conversations._id`.
    pub conversation_id: String,
    /// Hex string of the resolved `sabchat_contacts._id`.
    pub contact_id: String,
    /// Hex string of the resolved `sabchat_inboxes._id`.
    pub inbox_id: String,
}
