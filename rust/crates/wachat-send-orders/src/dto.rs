//! Request / response DTOs for [`crate::OrdersSender`].
//!
//! Deliberately minimal — they carry only what the sender needs to build
//! the Meta payloads, leaving the auth / contact-resolution concerns to
//! upstream layers (mirroring the TS where the actions accept a flat
//! `data` map and a pre-loaded `projectId`).

use bson::oid::ObjectId;

/// Caller-supplied input for an `order_details` send.
///
/// Field mapping vs `handleSendOrderDetailsMessage`'s `data` argument
/// (`whatsapp.actions.ts` lines 1684-1706):
///
/// | This field           | TS `data` key(s)                              |
/// | -------------------- | --------------------------------------------- |
/// | `to`                 | `waId` arg (resolved from contact upstream)   |
/// | `reference_id`       | `data.referenceId`                            |
/// | `items`              | `data.order.items` (mapped via [`OrderItem`]) |
/// | `subtotal_minor`     | `data.order.subtotal.value`                   |
/// | `tax_minor`          | `data.order.tax.value`                        |
/// | `shipping_minor`     | `data.order.shipping.value` (optional)        |
/// | `discount_minor`     | `data.order.discount.value` (optional)        |
/// | `currency`           | `data.currency` (e.g. `"INR"`)                |
/// | `payment_settings`   | TS doesn't ship this exact key (see below)    |
/// | `body_text`          | TS uses literal `Order <referenceId>` string  |
/// | `footer_text`        | TS doesn't ship a footer; we expose a slot    |
///
/// **`payment_settings`** — opaque JSON blob. The TS interleaves
/// `paymentType` and the optional `paymentLink` (as
/// `payment_configuration`) directly into `action.parameters`. We accept
/// an opaque `serde_json::Value` that the sender splices in at the same
/// level. Callers should pass a JSON object whose keys may include any
/// of: `payment_type`, `payment_configuration`, `type` (digital-goods /
/// physical-goods), `payment_settings`. Anything not understood is
/// passed through verbatim.
#[derive(Debug, Clone)]
pub struct SendOrderDetailsReq {
    /// Recipient WA id in any format `wachat_phone::normalize_e164`
    /// accepts. The sender canonicalises before passing to Meta.
    pub to: String,

    /// Caller-chosen reference for the order (echoed back in webhooks).
    pub reference_id: String,

    /// Line items.
    pub items: Vec<OrderItem>,

    /// Subtotal in minor units (e.g. paise for INR). Encoded as
    /// `{ "value": subtotal_minor, "offset": 100 }`.
    pub subtotal_minor: i64,

    /// Tax in minor units. Encoded as `{ "value": tax_minor, "offset":
    /// 100 }`.
    pub tax_minor: i64,

    /// Shipping in minor units (optional).
    pub shipping_minor: Option<i64>,

    /// Discount in minor units (optional).
    pub discount_minor: Option<i64>,

    /// ISO-4217 currency code (e.g. `"INR"`). Sent through to Meta
    /// as-is; we do not validate.
    pub currency: String,

    /// Opaque payment-settings blob spliced into `action.parameters`.
    /// See struct-level doc for shape conventions.
    pub payment_settings: serde_json::Value,

    /// Body text (the user-visible blurb above the order card). The TS
    /// always sets this to `Order <reference_id>`; we let the caller
    /// override.
    pub body_text: String,

    /// Optional footer text. The TS doesn't send one — we expose a slot
    /// for callers that want it.
    pub footer_text: Option<String>,
}

/// One line item in an `order_details` payload. Mirrors
/// `data.order.items[]` (TS lines 1694-1700).
#[derive(Debug, Clone)]
pub struct OrderItem {
    /// Catalog retailer id (matches the row in the merchant catalog).
    pub retailer_id: String,

    /// Display name for the item.
    pub name: String,

    /// Per-unit amount in minor units. Encoded as
    /// `{ "value": amount_minor, "offset": 100 }`.
    pub amount_minor: i64,

    /// Quantity. Meta's schema accepts a positive integer; we use `u32`
    /// to forbid negatives at compile time.
    pub quantity: u32,
}

/// Caller-supplied input for an `order_status` send.
///
/// Field mapping vs `handleSendOrderStatusMessage`'s `data` argument
/// (`whatsapp.actions.ts` lines 1768-1772):
///
/// | This field     | TS `data` key                                |
/// | -------------- | -------------------------------------------- |
/// | `to`           | `waId` arg (resolved from contact upstream)  |
/// | `reference_id` | `data.referenceId`                           |
/// | `status`       | `data.status`                                |
/// | `body_text`    | `data.description` OR the TS default string  |
///
/// The TS defaults the body text to
/// `"Order <referenceId> status: <status>"` when `description` is empty.
/// We push that decision upstream — callers always provide an explicit
/// `body_text` (which doubles as the `description` field on the inner
/// `order` object so webhooks see it too).
#[derive(Debug, Clone)]
pub struct SendOrderStatusReq {
    /// Recipient WA id. Same normalisation as
    /// [`SendOrderDetailsReq::to`].
    pub to: String,

    /// Reference id of the order being updated. Should match the
    /// `reference_id` of the original `order_details` message.
    pub reference_id: String,

    /// One of: `"pending"`, `"processed"`, `"shipped"`, `"completed"`,
    /// `"canceled"`. Meta also accepts `"payment_request"`, `"accepted"`,
    /// `"delivered"` per the TS union — we accept any string and let
    /// Meta validate, mirroring the TS which doesn't enforce client-side
    /// either.
    pub status: String,

    /// Body / description text. Sent both as `interactive.body.text` and
    /// as the inner `order.description` field (mirroring the TS).
    pub body_text: String,
}

/// Result of a successful send (either action).
///
/// Mirrors the two pieces of identity the TS persists / returns: the
/// Mongo `_id` of the new `outgoing_messages` row and Meta's `wamid`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SendOutcome {
    /// `_id` of the inserted `outgoing_messages` document.
    pub message_log_id: ObjectId,

    /// Meta `wamid` returned in `response.messages[0].id`. Used as the
    /// correlation key for status webhooks.
    pub wamid: String,
}
