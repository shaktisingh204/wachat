//! Wire DTOs (HTTP request / response shapes) for the public-API router.
//!
//! The TS route at `src/app/api/v1/messages/route.ts` accepts a generic
//! channels-registry payload (`{ channel, to, content, idempotency_key }`).
//! The Rust port narrows that to WhatsApp-only — the channels registry
//! has not been ported, and the WA branch is the only one that actually
//! ships outbound messages today. Customers that need other channels
//! continue to hit the Next.js route.
//!
//! Body shape (discriminated by `kind`):
//!
//! ```json
//! { "kind": "text", "projectId": "...", "to": "+91...", "body": "hi", "previewUrl": true }
//! { "kind": "image", "projectId": "...", "to": "...", "mediaId": "..." | "link": "https://...", "caption": "..." }
//! { "kind": "video", ... }
//! { "kind": "document", ..., "filename": "..." }
//! { "kind": "audio", ..., "mediaId" | "link" }
//! ```
//!
//! Mirrors [`wachat_send::SendMessageRequest`] one-to-one and is converted
//! into it inside the handler.

use serde::{Deserialize, Serialize};

/// `POST /v1/wachat/public/messages` request body.
///
/// Discriminated by the `kind` field — one of:
/// `text` | `image` | `video` | `document` | `audio`.
///
/// Media variants accept either `mediaId` (a previously-uploaded Meta
/// media id) or `link` (a public URL Meta will fetch from). The sender
/// returns 422 with code `VALIDATION_ERROR` if neither is provided.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SendMessageBody {
    /// Plain text. Body shape: `{ kind: "text", projectId, to, body, previewUrl? }`.
    #[serde(rename = "text")]
    Text {
        project_id: String,
        to: String,
        body: String,
        #[serde(default = "default_true")]
        preview_url: bool,
    },

    /// Image. Body shape: `{ kind: "image", projectId, to, mediaId?, link?, caption? }`.
    #[serde(rename = "image")]
    Image {
        project_id: String,
        to: String,
        #[serde(default)]
        media_id: Option<String>,
        #[serde(default)]
        link: Option<String>,
        #[serde(default)]
        caption: Option<String>,
    },

    /// Video. Body shape: `{ kind: "video", projectId, to, mediaId?, link?, caption? }`.
    #[serde(rename = "video")]
    Video {
        project_id: String,
        to: String,
        #[serde(default)]
        media_id: Option<String>,
        #[serde(default)]
        link: Option<String>,
        #[serde(default)]
        caption: Option<String>,
    },

    /// Document. Body shape: `{ kind: "document", projectId, to, mediaId?, link?, caption?, filename? }`.
    #[serde(rename = "document")]
    Document {
        project_id: String,
        to: String,
        #[serde(default)]
        media_id: Option<String>,
        #[serde(default)]
        link: Option<String>,
        #[serde(default)]
        caption: Option<String>,
        #[serde(default)]
        filename: Option<String>,
    },

    /// Audio. Body shape: `{ kind: "audio", projectId, to, mediaId?, link? }`.
    #[serde(rename = "audio")]
    Audio {
        project_id: String,
        to: String,
        #[serde(default)]
        media_id: Option<String>,
        #[serde(default)]
        link: Option<String>,
    },
}

fn default_true() -> bool {
    true
}

impl SendMessageBody {
    /// The project id (every variant carries one).
    pub fn project_id(&self) -> &str {
        match self {
            SendMessageBody::Text { project_id, .. }
            | SendMessageBody::Image { project_id, .. }
            | SendMessageBody::Video { project_id, .. }
            | SendMessageBody::Document { project_id, .. }
            | SendMessageBody::Audio { project_id, .. } => project_id,
        }
    }

    /// Convert into the engine-typed [`wachat_send::SendMessageRequest`].
    pub fn into_engine(self) -> wachat_send::SendMessageRequest {
        match self {
            SendMessageBody::Text {
                to,
                body,
                preview_url,
                ..
            } => wachat_send::SendMessageRequest::Text {
                to,
                body,
                preview_url,
            },
            SendMessageBody::Image {
                to,
                media_id,
                link,
                caption,
                ..
            } => wachat_send::SendMessageRequest::Image {
                to,
                media_id,
                link,
                caption,
            },
            SendMessageBody::Video {
                to,
                media_id,
                link,
                caption,
                ..
            } => wachat_send::SendMessageRequest::Video {
                to,
                media_id,
                link,
                caption,
            },
            SendMessageBody::Document {
                to,
                media_id,
                link,
                caption,
                filename,
                ..
            } => wachat_send::SendMessageRequest::Document {
                to,
                media_id,
                link,
                caption,
                filename,
            },
            SendMessageBody::Audio {
                to, media_id, link, ..
            } => wachat_send::SendMessageRequest::Audio { to, media_id, link },
        }
    }
}

/// Standard send response — the Mongo log id (hex), Meta `wamid`, and a
/// `status` literal (`"sent"`).
///
/// Matches the rough shape the TS route returned: `{ message_id,
/// provider_message_id, status }` — renamed to camelCase for consistency
/// with the rest of the Rust API.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendResponse {
    /// `_id` of the new `outgoing_messages` row. Equivalent to the TS
    /// `message_id`.
    pub message_id: String,
    /// Meta `wamid` returned in `response.messages[0].id`. Equivalent to
    /// the TS `provider_message_id`.
    pub provider_message_id: String,
    /// Always `"sent"` on the success path. Failure paths surface as
    /// `ApiError` envelopes, not as a status string.
    pub status: &'static str,
    /// Always `"whatsapp"` here — present for forward-compatibility with
    /// the TS shape that carried a `channel` discriminator.
    pub channel: &'static str,
}

impl SendResponse {
    pub fn ok(message_id: String, provider_message_id: String) -> Self {
        Self {
            message_id,
            provider_message_id,
            status: "sent",
            channel: "whatsapp",
        }
    }
}
