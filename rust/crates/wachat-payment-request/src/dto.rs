//! Request / response DTOs for [`crate::PaymentRequestSender`].
//!
//! These mirror the TS shapes from `src/app/actions/whatsapp.actions.ts`
//! but use Rust idiom (typed enums, `i64` minor units, `chrono` timestamps).
//!
//! ## Money representation
//!
//! All monetary amounts are passed in **minor units** (`i64`):
//!
//! * INR `12.34` ⇒ `1234`
//! * JPY `1500`  ⇒ `1500` (JPY has no minor unit; treat as offset=1)
//!
//! On the wire, Meta's `order_details.action.parameters` expects
//! `{ value: <integer>, offset: 100 }`. We pin `offset = 100` for the
//! currencies SabNode supports today (INR, USD, EUR, GBP — all 2-decimal).
//! When SabNode adds a 0- or 3-decimal currency this constant moves to
//! the [`SendPaymentReq`] level.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Caller-supplied input for a single WhatsApp payment-request send.
///
/// Field mapping vs `handleRequestWhatsAppPayment`'s `formData`
/// (`whatsapp.actions.ts` lines 720-753):
///
/// | This field           | TS form key / source                   |
/// | -------------------- | -------------------------------------- |
/// | `to`                 | resolved from `contactId` -> `contact.waId`        |
/// | `reference_id`       | `formData.externalReference`           |
/// | `amount_minor`       | `formData.amount` * 100                |
/// | `currency`           | hard-coded `"INR"` in TS               |
/// | `items`              | constructed from `formData.description`|
/// | `configuration_name` | not in this TS path; required for `order_details` |
/// | `body_text`          | `formData.description`                 |
///
/// The TS uses the simpler `payment_requests` endpoint which doesn't take
/// `items`; this Rust port targets the richer interactive `order_details`
/// flavor so item-level breakdown survives end-to-end.
#[derive(Debug, Clone)]
pub struct SendPaymentReq {
    /// Recipient phone in any format `wachat_phone::normalize_e164` accepts.
    /// The sender canonicalizes it before passing to Meta. Meta's `order_details`
    /// payload expects bare digits (no `+`).
    pub to: String,

    /// Caller-supplied stable id for this payment request. Used as the
    /// correlation key for status webhooks. Unique within a project.
    pub reference_id: String,

    /// Total amount in minor units (e.g. paise / cents). Sum of items;
    /// the sender does NOT recompute it — single source of truth from
    /// the caller, matching the TS `formData.amount` flow.
    pub amount_minor: i64,

    /// ISO 4217 currency code (uppercase, e.g. `"INR"`, `"USD"`).
    pub currency: String,

    /// Line items breakdown. Meta requires at least one item for the
    /// `order_details` flavor; the sender returns `Validation` if empty.
    pub items: Vec<PaymentItem>,

    /// The Meta payment-configuration name created via
    /// `payment_configurations` (TS `whatsapp.actions.ts` line 870+).
    /// Threaded into the Meta payload as `payment_configuration` so
    /// Meta knows which provider (Razorpay / PayU / UPI VPA) to use.
    pub configuration_name: String,

    /// Body text shown to the recipient above the order card.
    pub body_text: String,
}

/// One line in a payment request's order breakdown.
///
/// Mirrors Meta's `order_details.action.parameters.order.items[]`:
/// ```text
/// { name, amount: { value, offset: 100 }, quantity }
/// ```
/// We omit `retailer_id` (catalog-only field) and `sale_amount` from this
/// minimal port; callers that need them should extend the wire payload in
/// a follow-up slice.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentItem {
    /// Human-readable item name shown on the order card.
    pub name: String,

    /// Per-unit amount in minor units (e.g. paise / cents).
    pub amount_minor: i64,

    /// Quantity of this item. Must be `>= 1` — the sender returns
    /// `Validation` for zero.
    pub quantity: u32,
}

/// Result of a successful send.
///
/// Mirrors the two pieces of identity the TS persists: the Mongo `_id` of
/// the new `payment_requests` correlation doc and Meta's `wamid`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SendOutcome {
    /// `_id` of the inserted `payment_requests` document.
    pub payment_request_id: ObjectId,

    /// Meta `wamid` returned in `response.messages[0].id`. Used as the
    /// correlation key for `outgoing_messages` status webhooks.
    pub wamid: String,
}

/// Lightweight status projection returned by [`crate::PaymentRequestSender::get_status`].
///
/// Mirrors what the TS `getPaymentRequestStatus` returns, plus a
/// `paid_at` timestamp that the webhook updater stamps when status moves
/// to `COMPLETED`. The string status mirrors Meta's
/// `FacebookPaymentRequest.status` enum (`"PENDING" | "CANCELED" |
/// "DECLINED" | "COMPLETED" | "EXPIRED"`); we keep it as a `String` for
/// forward-compat with new Meta states.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentStatus {
    pub reference_id: String,
    pub status: String,
    pub paid_at: Option<DateTime<Utc>>,
}

/// Full Mongo doc shape for the `payment_requests` collection.
///
/// Returned by [`crate::PaymentRequestSender::list_for_project`] and
/// internally hydrated for [`crate::PaymentRequestSender::get_status`]
/// before projection.
///
/// Fields use camelCase to match the TS `outgoing_messages` style and
/// the rest of the SabNode Mongo schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequest {
    /// Mongo `_id`.
    #[serde(rename = "_id")]
    pub id: ObjectId,

    /// Owning project. FK into the `projects` collection.
    pub project_id: ObjectId,

    /// Caller-supplied stable id (unique within the project).
    pub reference_id: String,

    /// Recipient phone (bare digits, no `+` — matches `Contact.waId`).
    pub recipient: String,

    /// Total amount in minor units.
    pub amount_minor: i64,

    /// ISO 4217 currency code.
    pub currency: String,

    /// Original line items.
    pub items: Vec<PaymentItemDoc>,

    /// Meta payment configuration name.
    pub configuration_name: String,

    /// Current status — see [`PaymentRequestStatus`] for canonical values.
    pub status: String,

    /// Meta `wamid` of the interactive message that carried this request.
    /// Used by the webhook updater to correlate status updates back here.
    pub wamid: String,

    /// Timestamp of the move to `COMPLETED`. `None` until paid.
    pub paid_at: Option<bson::DateTime>,

    /// Created-at timestamp.
    pub created_at: bson::DateTime,

    /// Last-update timestamp (set on every status transition).
    pub updated_at: bson::DateTime,
}

/// Persisted form of [`PaymentItem`]. Identical shape, with `serde` derives
/// so it can ride inside [`PaymentRequest`].
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PaymentItemDoc {
    pub name: String,
    pub amount_minor: i64,
    pub quantity: u32,
}

impl From<&PaymentItem> for PaymentItemDoc {
    fn from(p: &PaymentItem) -> Self {
        Self {
            name: p.name.clone(),
            amount_minor: p.amount_minor,
            quantity: p.quantity,
        }
    }
}

/// Canonical status strings for a payment request. The Mongo doc stores
/// the string form so unknown future Meta states round-trip cleanly; this
/// enum is provided for callers that want to match exhaustively.
///
/// Mirrors `FacebookPaymentRequest.status` from `src/lib/definitions.ts`
/// line 3009.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PaymentRequestStatus {
    /// Initial state on `send`, before any user interaction.
    Pending,
    /// User explicitly canceled.
    Canceled,
    /// Provider declined (insufficient funds, KYC, …).
    Declined,
    /// Payment succeeded.
    Completed,
    /// Request timed out without action.
    Expired,
}

impl PaymentRequestStatus {
    /// Canonical wire string.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Canceled => "CANCELED",
            Self::Declined => "DECLINED",
            Self::Completed => "COMPLETED",
            Self::Expired => "EXPIRED",
        }
    }
}
