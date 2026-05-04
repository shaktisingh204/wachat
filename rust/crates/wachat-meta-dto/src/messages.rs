//! Request / response shapes for `POST /{phone-number-id}/messages`.
//!
//! Source of truth: `src/app/actions/whatsapp.actions.ts` and
//! `src/app/actions/send-template.actions.ts`. The TS code builds plain JS
//! objects with a `type` discriminator and a sibling key matching that type
//! (`text`, `template`, `image`, etc.). Serde's internally-tagged enum
//! representation matches that wire shape exactly.

use serde::{Deserialize, Serialize};

/// Discriminated message payload. Serialises as `{ "type": "text", "to": ..., "text": {...} }`.
///
/// `Interactive` is intentionally a `serde_json::Value` because the interactive
/// envelope explodes into many subtypes (button, list, product_list, flow,
/// location_request_message, address_message, order_details, order_status,
/// catalog_message, cta_url) — each with its own `action`/`parameters` shape.
/// The TS callsites already build them as untyped objects; locking them down
/// here would just create maintenance churn.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum SendMessage {
    Text {
        to: String,
        text: TextBody,
        #[serde(skip_serializing_if = "Option::is_none")]
        recipient_type: Option<String>,
    },
    Template {
        to: String,
        template: TemplateBody,
    },
    Interactive {
        to: String,
        interactive: serde_json::Value,
    },
    Image {
        to: String,
        image: MediaBody,
    },
    Document {
        to: String,
        document: MediaBody,
    },
    Audio {
        to: String,
        audio: MediaBody,
    },
    Video {
        to: String,
        video: MediaBody,
    },
}

/// Body of a `text` message. `preview_url` defaults to `false` per Meta docs;
/// the SabNode TS sends `true` for chat sends to render link previews.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextBody {
    pub body: String,
    #[serde(default)]
    pub preview_url: bool,
}

/// Outer template send shape — `name`, `language.code`, optional `components`.
/// `components` is `Vec<Value>` because each component (HEADER/BODY/BUTTONS)
/// has its own parameter taxonomy and the TS already builds them dynamically.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateBody {
    pub name: String,
    pub language: TemplateLanguage,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub components: Vec<serde_json::Value>,
}

/// `{ "code": "en_US" }`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateLanguage {
    pub code: String,
}

/// Common shape for image/video/document/audio bodies. Either `id` (uploaded
/// media) or `link` (public URL) is required by Meta — we don't enforce that
/// here; the caller picks one.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MediaBody {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub caption: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
}

/// Outer envelope. Every `POST /messages` body must include
/// `messaging_product: "whatsapp"`. The TS hard-codes this string in every
/// callsite — we centralise it via `Default` / [`SendEnvelope::new`].
///
/// Note: the field is `String`, not `&'static str`, because `&'static str`
/// can't satisfy `Deserialize<'de>` for arbitrary input lifetimes (Serde
/// would need to borrow the JSON for `'static`). We always populate it with
/// the literal `"whatsapp"` via the provided constructors, so practical use
/// is identical.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendEnvelope {
    pub messaging_product: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient_type: Option<String>,
    #[serde(flatten)]
    pub message: SendMessage,
}

/// The wire constant Meta requires on every `/messages` POST.
pub const MESSAGING_PRODUCT_WHATSAPP: &str = "whatsapp";

impl SendEnvelope {
    pub fn new(message: SendMessage) -> Self {
        Self {
            messaging_product: MESSAGING_PRODUCT_WHATSAPP.to_owned(),
            recipient_type: None,
            message,
        }
    }

    pub fn with_recipient_type(mut self, recipient_type: impl Into<String>) -> Self {
        self.recipient_type = Some(recipient_type.into());
        self
    }
}

impl Default for SendEnvelope {
    fn default() -> Self {
        Self {
            messaging_product: MESSAGING_PRODUCT_WHATSAPP.to_owned(),
            recipient_type: None,
            message: SendMessage::Text {
                to: String::new(),
                text: TextBody {
                    body: String::new(),
                    preview_url: false,
                },
                recipient_type: None,
            },
        }
    }
}

/// Response to `POST /{phone-number-id}/messages`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendResponse {
    pub messaging_product: String,
    #[serde(default)]
    pub contacts: Vec<SendContact>,
    #[serde(default)]
    pub messages: Vec<SendMessageId>,
}

/// Each entry in `messages[]`. The TS reads `response.data.messages[0].id`
/// and stores it as `wamid`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageId {
    pub id: String,
}

/// Each entry in `contacts[]` — echoes the input number and the canonical
/// WhatsApp ID (`wa_id`) that Meta resolved it to.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendContact {
    pub input: String,
    pub wa_id: String,
}
