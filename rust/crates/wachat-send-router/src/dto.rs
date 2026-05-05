//! Wire DTOs (HTTP request / response shapes) that the send-path router
//! speaks.
//!
//! All public fields are `serde(rename_all = "camelCase")`-aligned so the
//! existing TS / React clients can talk to the Rust API without a
//! follow-up adapter layer. ObjectIds are exchanged as hex strings on
//! the wire — never as the raw `bson::oid::ObjectId` shape (whose serde
//! encoding is format-dependent).

use bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// `POST /messages/send` — generic discriminated send
// ---------------------------------------------------------------------------

/// `POST /messages/send` request body.
///
/// Discriminated by the `kind` field — one of:
/// `text` | `image` | `video` | `document` | `audio`. Mirrors
/// [`wachat_send::SendMessageRequest`] one-to-one and is converted into
/// it inside the handler before it's handed to the sender.
///
/// Media variants accept either `mediaId` (a previously-uploaded Meta
/// media id) or `link` (a public URL Meta will fetch from). At least one
/// must be provided — the sender returns
/// [`sabnode_common::error::ApiError::Validation`] otherwise.
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
    /// Returns the project id (every variant carries one).
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

// ---------------------------------------------------------------------------
// `POST /messages/catalog` — interactive product_list
// ---------------------------------------------------------------------------

/// `POST /messages/catalog` request body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendCatalogBody {
    pub project_id: String,
    /// Recipient WA id (E.164 digits or `+CC...`; sender canonicalizes).
    pub to: String,
    /// Meta catalog id (the value the TS reads from `project.connectedCatalogId`).
    pub catalog_id: String,
    /// First / featured product retailer id. The engine treats `None` as an
    /// empty `product_items` array (matches the TS `['']` edge case).
    #[serde(default)]
    pub product_retailer_id: Option<String>,
    /// Optional body text shown above the product list.
    #[serde(default)]
    pub body_text: Option<String>,
    /// Optional footer text.
    #[serde(default)]
    pub footer_text: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /messages/cta-url` — interactive cta_url
// ---------------------------------------------------------------------------

/// `POST /messages/cta-url` request body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendCtaUrlBody {
    pub project_id: String,
    pub to: String,
    /// Optional body text shown above the CTA button.
    #[serde(default)]
    pub body_text: Option<String>,
    /// Button label (e.g. `"Open"`).
    pub display_text: String,
    /// URL the CTA button points at.
    pub url: String,
    #[serde(default)]
    pub header_text: Option<String>,
    #[serde(default)]
    pub footer_text: Option<String>,
}

// ---------------------------------------------------------------------------
// `POST /messages/location-request` — interactive location_request_message
// ---------------------------------------------------------------------------

/// `POST /messages/location-request` request body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendLocationRequestBody {
    pub project_id: String,
    pub phone_number_id: String,
    pub to: String,
    pub body_text: String,
}

// ---------------------------------------------------------------------------
// `POST /messages/address` — interactive address_message
// ---------------------------------------------------------------------------

/// `POST /messages/address` request body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendAddressBody {
    pub project_id: String,
    pub phone_number_id: String,
    pub to: String,
    pub body_text: String,
    /// ISO-3166 alpha-2 country code (e.g. `"IN"`, `"US"`).
    pub country: String,
    /// Pre-filled address fields (Meta `address_message` schema, varies
    /// per country). Pass `null` for an empty form.
    #[serde(default)]
    pub values: Value,
}

// ---------------------------------------------------------------------------
// `POST /messages/order-details` — interactive order_details
// ---------------------------------------------------------------------------

/// `POST /messages/order-details` request body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendOrderDetailsBody {
    pub project_id: String,
    pub to: String,
    pub reference_id: String,
    pub items: Vec<OrderItemBody>,
    pub subtotal_minor: i64,
    pub tax_minor: i64,
    #[serde(default)]
    pub shipping_minor: Option<i64>,
    #[serde(default)]
    pub discount_minor: Option<i64>,
    pub currency: String,
    #[serde(default)]
    pub payment_settings: Value,
    pub body_text: String,
    #[serde(default)]
    pub footer_text: Option<String>,
}

/// Wire shape for one order item (matches the engine's `OrderItem` exactly).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrderItemBody {
    pub retailer_id: String,
    pub name: String,
    pub amount_minor: i64,
    pub quantity: u32,
}

// ---------------------------------------------------------------------------
// `POST /messages/order-status` — interactive order_status
// ---------------------------------------------------------------------------

/// `POST /messages/order-status` request body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendOrderStatusBody {
    pub project_id: String,
    pub to: String,
    pub reference_id: String,
    /// `pending` | `processed` | `shipped` | `completed` | `canceled` | `delivered` | `accepted` | `payment_request`.
    pub status: String,
    pub body_text: String,
}

// ---------------------------------------------------------------------------
// `POST /contacts/resolve` — find_or_create
// ---------------------------------------------------------------------------

/// `POST /contacts/resolve` request body.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveContactBody {
    pub project_id: String,
    pub phone_number_id: String,
    pub wa_id: String,
}

// ---------------------------------------------------------------------------
// `GET /chat/initial`
// ---------------------------------------------------------------------------

/// Query string for `GET /chat/initial`.
///
/// Mirrors the TS `getInitialChatData(projectId, phoneNumberId?, contactId?, waId?)`
/// signature one-to-one.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitialChatQuery {
    pub project_id: String,
    #[serde(default)]
    pub phone_number_id: Option<String>,
    #[serde(default)]
    pub contact_id: Option<String>,
    #[serde(default)]
    pub wa_id: Option<String>,
}

// ---------------------------------------------------------------------------
// `GET /chat/conversation/:contact_id`
// ---------------------------------------------------------------------------

/// Query string for `GET /chat/conversation/:contact_id`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversationQuery {
    /// Optional page-size cap (engine default applies when `None`).
    #[serde(default)]
    pub limit: Option<u32>,
}

// ---------------------------------------------------------------------------
// `POST /payment-requests/send`
// ---------------------------------------------------------------------------

/// `POST /payment-requests/send` request body.
///
/// Carries the project id alongside the engine-typed payload. The
/// `payload` blob is forwarded to
/// [`wachat_payment_request::SendPaymentRequestReq`] verbatim — keeping
/// it as a `serde_json::Value` here means the router stays stable when
/// the engine adds optional fields.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequestBody {
    pub project_id: String,
    pub to: String,
    pub reference_id: String,
    pub amount_minor: i64,
    pub currency: String,
    pub items: Vec<PaymentItemBody>,
    pub configuration_name: String,
    pub body_text: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentItemBody {
    pub name: String,
    pub amount_minor: i64,
    pub quantity: u32,
}

// ---------------------------------------------------------------------------
// `GET /payment-requests`
// ---------------------------------------------------------------------------

/// Query string for `GET /payment-requests`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequestListQuery {
    pub project_id: String,
}

// ---------------------------------------------------------------------------
// Generic responses
// ---------------------------------------------------------------------------

/// Generic `{ ok: true }` envelope used by endpoints that don't return
/// additional data (e.g. mark-read / mark-unread).
#[derive(Debug, Clone, Serialize)]
pub struct OkResponse {
    pub ok: bool,
}

impl OkResponse {
    pub fn ok() -> Self {
        Self { ok: true }
    }
}

/// Standard send response — the Mongo log id (hex) and Meta `wamid`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendResponse {
    pub message_log_id: String,
    pub wamid: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Render an `ObjectId` to its hex string for JSON responses.
pub fn oid_hex(oid: &ObjectId) -> String {
    oid.to_hex()
}
