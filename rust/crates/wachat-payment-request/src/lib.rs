//! # wachat-payment-request
//!
//! WhatsApp **payment request** send + status reads — Phase 4, slice 8 of
//! the SabNode TS-to-Rust port.
//!
//! Ports three TS entry points from `src/app/actions/whatsapp.actions.ts`:
//!
//! 1. **`handleRequestWhatsAppPayment`** (line 719) — builds a Meta payment
//!    request payload and writes both an `outgoing_messages` log and a
//!    `payment_requests` correlation doc.
//! 2. **`getPaymentRequestStatus`** (line 796) — reads the cached status by
//!    `reference_id` (the TS reads from Meta directly; we read from the
//!    Mongo correlation doc that the webhook updater populates).
//! 3. **`getPaymentRequests`** (line 822) — lists payment requests for a
//!    project (the TS pulls them from Meta; we serve them out of Mongo so
//!    paid/expired statuses populated by the webhook flow are visible).
//!
//! ## What this slice does **not** do
//!
//! * Project / contact lookup — callers pass an already-authorized
//!   `&Project` and a fully-formed `SendPaymentReq` (matching the way the
//!   TS resolves the contact upstream of the Meta call).
//! * Status webhook handling — that's the job of `wachat-webhook-status`
//!   / a future `wachat-webhook-payments` slice. This crate only **reads**
//!   the cached status from `payment_requests`.
//! * `revalidatePath` and Next.js cache concerns.
//! * Charging credits / writing the `transactions` row — the TS does this
//!   inline as a fire-and-forget side write; in the Rust port the
//!   billing concern moves to a sibling crate that subscribes to the
//!   payment status webhook.
//!
//! ## Meta API version
//!
//! The TS hard-codes `const API_VERSION = 'v23.0';` at the top of
//! `whatsapp.actions.ts`. We pin the same default at the [`MetaClient`]
//! construction site (callers own the `MetaClient` and pick the version).

#![forbid(unsafe_code)]

mod dto;
mod sender;

pub use dto::{
    PaymentItem, PaymentRequest, PaymentRequestStatus, PaymentStatus, SendOutcome, SendPaymentReq,
};
pub use sender::PaymentRequestSender;

/// Mongo collection name for outgoing message logs.
///
/// TS reference (`whatsapp.actions.ts` line 770):
/// ```text
/// db.collection('outgoing_messages').insertOne({ ... type: 'payment_request' ... })
/// ```
pub const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";

/// Mongo collection name for the payment-request correlation doc.
///
/// New in the Rust port (the TS resolved status by re-querying Meta in
/// `getPaymentRequestStatus`, which is slow + rate-limited). The webhook
/// updater writes status transitions here keyed by `reference_id`; this
/// crate reads them back.
pub const PAYMENT_REQUESTS_COLL: &str = "payment_requests";

/// Meta Graph API version the TS pins. Source of truth: `whatsapp.actions.ts`
/// `const API_VERSION = 'v23.0';`.
///
/// Re-exported so callers building a [`MetaClient`] for this slice can do
/// so without re-encoding the version string.
pub const META_API_VERSION: &str = "v25.0";

// Re-export `MetaClient` for the rare ergonomic case where the caller
// constructs the sender inline (e.g. in tests). Most call sites get one
// from app state.
pub use wachat_meta_client::MetaClient;
