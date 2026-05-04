//! Inbound webhook payload (`POST /api/webhooks/meta`).
//!
//! Source of truth: `src/app/api/webhooks/meta/route.ts` and
//! `src/lib/webhook-processor.ts`. Top-level shape:
//!
//! ```text
//! { object: "whatsapp_business_account",
//!   entry: [
//!     { id: "<waba-id>",
//!       changes: [
//!         { field: "messages",
//!           value: { messaging_product, metadata, contacts?, messages?, statuses?, errors? } }
//!       ] }
//! ] }
//! ```
//!
//! The webhook processor branches on `change.field` (`"messages"`,
//! `"calls"`, `"payment_configuration_update"`, account/template updates,
//! etc.) — each carries its own `value` shape. We type the common
//! `messages` field shape and leave the open-ended payloads (interactive,
//! button, context, conversation, pricing) as `serde_json::Value`.

use serde::{Deserialize, Serialize};

use crate::api_error::MetaApiError;
use crate::messages::{MediaBody, TextBody};

/// Top-level webhook envelope.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookEvent {
    /// Always `"whatsapp_business_account"` for WhatsApp; `"page"` for
    /// Messenger/Comments — we accept the string and let the consumer dispatch.
    pub object: String,
    #[serde(default)]
    pub entry: Vec<Entry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub id: String,
    #[serde(default)]
    pub changes: Vec<Change>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    pub field: String,
    pub value: ChangeValue,
}

/// Union of all keys we've observed on `change.value`. All optional because
/// each `field` populates a different subset.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ChangeValue {
    pub messaging_product: Option<String>,
    pub metadata: Option<Metadata>,
    pub contacts: Option<Vec<WebhookContact>>,
    pub messages: Option<Vec<InboundMessage>>,
    pub statuses: Option<Vec<StatusUpdate>>,
    pub errors: Option<Vec<MetaApiError>>,
}

/// `value.metadata` — identifies the receiving phone number.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub display_phone_number: String,
    pub phone_number_id: String,
}

/// One incoming user message. `r#type` is the wire `"type"` discriminator
/// (text/image/audio/video/document/button/interactive/location/order/...).
/// We type the common payload bodies and keep the rare/open-ended ones as
/// `serde_json::Value`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboundMessage {
    pub from: String,
    pub id: String,
    /// Unix timestamp **as a string** — Meta sends e.g. `"1717000000"`.
    pub timestamp: String,
    pub r#type: String,
    pub text: Option<TextBody>,
    pub image: Option<MediaBody>,
    pub video: Option<MediaBody>,
    pub audio: Option<MediaBody>,
    pub document: Option<MediaBody>,
    pub button: Option<serde_json::Value>,
    pub interactive: Option<serde_json::Value>,
    pub context: Option<serde_json::Value>,
}

/// Delivery status update. `status` is `sent` | `delivered` | `read` | `failed`.
/// `conversation` and `pricing` are open-ended sub-objects (Meta's billing
/// telemetry) so we keep them as raw `Value`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusUpdate {
    pub id: String,
    pub status: String,
    pub timestamp: String,
    pub recipient_id: String,
    pub conversation: Option<serde_json::Value>,
    pub pricing: Option<serde_json::Value>,
    pub errors: Option<Vec<MetaApiError>>,
}

/// `value.contacts[]` — sender profile info.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookContact {
    pub profile: ContactProfile,
    pub wa_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContactProfile {
    pub name: Option<String>,
}
