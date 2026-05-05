//! Request / response DTOs for [`crate::MessageSender`].
//!
//! These mirror the typed message branches the TS `handleSendMessage`
//! constructs at runtime by inspecting the `mediaFile` argument
//! (`whatsapp.actions.ts` lines 422-469). We replace the runtime branching
//! with an `enum` so callers can't accidentally build an invalid pair like
//! `image` + `text.body`.

use bson::oid::ObjectId;

/// Caller-supplied input for one chat-side send.
///
/// One variant per Meta `type` discriminator that the TS action emits.
/// Field mapping vs the TS `data` argument (`whatsapp.actions.ts` lines
/// 411 + 422-469):
///
/// | This field    | TS source                                       |
/// | ------------- | ----------------------------------------------- |
/// | `to`          | `data.waId` (digits, no `+`) — we accept `+CC…` |
/// | `body`        | `data.messageText` (text branch)                |
/// | `caption`     | `data.messageText` (media branch)               |
/// | `media_id`    | result of inline `POST /{phone-number-id}/media`|
/// | `link`        | (not present in the TS; supported here so callers may skip the upload entirely) |
/// | `filename`    | `mediaFile.name` (document branch)              |
/// | `preview_url` | hard-coded `true` in the TS (line 468); we expose it |
///
/// At least one of `media_id` or `link` is required for the media variants
/// — the sender returns [`sabnode_common::error::ApiError::Validation`]
/// otherwise.
#[derive(Debug, Clone)]
pub enum SendMessageRequest {
    /// Plain text message. TS reference: lines 466-468 — `text: { body, preview_url: true }`.
    Text {
        /// Recipient phone in any format `wachat_phone::normalize_e164`
        /// accepts. The sender canonicalizes it before passing to Meta.
        to: String,
        /// Body text. The TS sources this from `data.messageText`.
        body: String,
        /// Whether Meta should auto-render link previews. The TS hard-codes
        /// `true`; we expose the knob so non-chat callers (e.g. broadcast)
        /// can pick.
        preview_url: bool,
    },
    /// Image message. TS lines 449-453 — `image: { id, caption? }`.
    Image {
        to: String,
        /// Already-uploaded Meta media id. Mutually-required-with `link`.
        media_id: Option<String>,
        /// Public URL (Meta will fetch from here). Mutually-required-with `media_id`.
        link: Option<String>,
        /// Optional caption. The TS forwards `messageText` here when set.
        caption: Option<String>,
    },
    /// Video message. TS lines 454-458 — `video: { id, caption? }`.
    Video {
        to: String,
        media_id: Option<String>,
        link: Option<String>,
        caption: Option<String>,
    },
    /// Document message. TS lines 459-464 — `document: { id, filename, caption? }`.
    Document {
        to: String,
        media_id: Option<String>,
        link: Option<String>,
        caption: Option<String>,
        /// Filename Meta will surface to the recipient. The TS sources this
        /// from `mediaFile.name`.
        filename: Option<String>,
    },
    /// Audio message. The TS doesn't currently emit this branch (the
    /// `mediaFile.type.split('/')[0] === 'audio'` case falls into the
    /// document branch), but Meta supports it as a first-class type and
    /// the broadcast worker needs it. Keeping it here means Phase 4
    /// callers don't need a follow-up slice.
    Audio {
        to: String,
        media_id: Option<String>,
        link: Option<String>,
    },
}

impl SendMessageRequest {
    /// The recipient phone, regardless of variant.
    pub fn to(&self) -> &str {
        match self {
            SendMessageRequest::Text { to, .. }
            | SendMessageRequest::Image { to, .. }
            | SendMessageRequest::Video { to, .. }
            | SendMessageRequest::Document { to, .. }
            | SendMessageRequest::Audio { to, .. } => to,
        }
    }

    /// The Meta `type` discriminator string this variant serialises as
    /// (`"text"`, `"image"`, `"video"`, `"document"`, `"audio"`). Matches
    /// the TS `OutgoingMessage['type']` union exactly so the
    /// `outgoing_messages.type` field stays wire-compatible.
    pub fn meta_type(&self) -> &'static str {
        match self {
            SendMessageRequest::Text { .. } => "text",
            SendMessageRequest::Image { .. } => "image",
            SendMessageRequest::Video { .. } => "video",
            SendMessageRequest::Document { .. } => "document",
            SendMessageRequest::Audio { .. } => "audio",
        }
    }
}

/// Result of a successful send.
///
/// Mirrors the two pieces of identity the TS persists / returns: the Mongo
/// `_id` of the new `outgoing_messages` row and Meta's `wamid`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SendOutcome {
    /// `_id` of the inserted `outgoing_messages` document.
    pub message_log_id: ObjectId,

    /// Meta `wamid` returned in `response.messages[0].id` (TS line 473).
    /// Used as the correlation key for status webhooks.
    pub wamid: String,
}
