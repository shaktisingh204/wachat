//! Wire-format DTOs for the SabChat Instagram channel adapter.
//!
//! These shapes are the **normalised** payload the Next.js webhook shim
//! sends to Rust — Meta's raw Instagram Graph webhook envelope is heavy
//! and lives in TS (`src/lib/instagram/webhook.ts`). The shim flattens
//! the bits we care about (IG user id, sender id, text, attachment URL,
//! provider message id) into the request bodies below.
//!
//! Every body uses `#[serde(rename_all = "camelCase")]` so the wire JSON
//! matches what the TS shim already produces.

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/channels/instagram/ingest` — DM ingest
// ---------------------------------------------------------------------------

/// Body for `POST /ingest`. Mirrors the normalised shape the TS shim
/// produces from a Meta DM webhook event:
///
/// ```json
/// {
///   "igUserId": "17841400000000000",
///   "senderId":  "1234567890",
///   "senderUsername": "jane.doe",
///   "text": "hello",
///   "attachmentUrl": null,
///   "attachmentMime": null,
///   "providerMessageId": "mid.0000",
///   "timestamp": "2026-05-27T12:00:00Z"
/// }
/// ```
///
/// `providerMessageId` is the idempotency key — replays with the same
/// id are no-ops that return the existing `messageId`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestDmBody {
    /// Instagram Graph "IG user id" (the business account that owns the
    /// DM, NOT the sender). Used to look up the inbox.
    pub ig_user_id: String,

    /// Page-scoped sender id (the visitor).
    pub sender_id: String,

    /// Display handle of the sender if Meta returned one.
    #[serde(default)]
    pub sender_username: Option<String>,

    /// Free-text body. At least one of `text` / `attachmentUrl` must be
    /// present.
    #[serde(default)]
    pub text: Option<String>,

    /// CDN URL of the attached media if any. Stored verbatim — the
    /// adapter does not rehost into SabFiles in this slice; that's a
    /// follow-up worker concern.
    #[serde(default)]
    pub attachment_url: Option<String>,

    /// Best-effort MIME type for the attachment (`image/jpeg`,
    /// `video/mp4`, `audio/mp4`, etc.).
    #[serde(default)]
    pub attachment_mime: Option<String>,

    /// Meta-side message id. **Idempotency key** for this endpoint.
    pub provider_message_id: String,

    /// Optional ISO 8601 timestamp from the webhook event. Falls back to
    /// `Utc::now()` if absent.
    #[serde(default)]
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

// ---------------------------------------------------------------------------
// `POST /v1/sabchat/channels/instagram/comment` — comment ingest
// ---------------------------------------------------------------------------

/// Body for `POST /comment`. Same flow as `/ingest` but for Instagram
/// post comments. The persisted message is a `Card` content block citing
/// the parent post so the agent inbox renders the comment in context.
///
/// `commentId` is the idempotency key — replays return the existing
/// `messageId`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestCommentBody {
    /// Instagram Graph "IG user id" (the business account that owns the
    /// post). Used to look up the inbox.
    pub ig_user_id: String,

    /// Page-scoped commenter id.
    pub sender_id: String,

    /// Optional display handle of the commenter.
    #[serde(default)]
    pub sender_username: Option<String>,

    /// Parent post id (Instagram media id).
    pub post_id: String,

    /// Meta-side comment id. **Idempotency key** for this endpoint.
    pub comment_id: String,

    /// Comment body.
    pub text: String,

    /// Optional ISO 8601 timestamp from the webhook event.
    #[serde(default)]
    pub timestamp: Option<chrono::DateTime<chrono::Utc>>,
}

// ---------------------------------------------------------------------------
// Response shape (shared by both endpoints)
// ---------------------------------------------------------------------------

/// `{ conversationId, messageId }` returned by both ingest endpoints.
/// The TS shim passes this back to Meta's webhook (which only cares
/// about HTTP 200) but also persists it for cross-system observability.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IngestResponse {
    pub conversation_id: String,
    pub message_id: String,
}
