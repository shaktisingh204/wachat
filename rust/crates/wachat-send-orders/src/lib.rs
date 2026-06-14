//! # wachat-send-orders
//!
//! **Send** side of the wachat interactive **orders** module — Phase 4,
//! slice 4 of the SabNode TS-to-Rust port.
//!
//! Ports two TypeScript actions from `src/app/actions/whatsapp.actions.ts`:
//!
//! * `handleSendOrderDetailsMessage` (line ~1679) — sends an interactive
//!   `order_details` message (Meta "Pay Now" / `review_and_pay` flow). The
//!   user receives an itemised order with currency, totals, and a payment
//!   configuration link.
//! * `handleSendOrderStatusMessage` (line ~1763) — sends an interactive
//!   `order_status` message (`review_order`) to inform the recipient of an
//!   existing order's status (`pending` / `processed` / `shipped` /
//!   `completed` / `canceled`).
//!
//! ## Meta wire shape — `order_details`
//!
//! Mirrors the TS payload byte-for-byte (TS lines 1713-1734):
//!
//! ```jsonc
//! {
//!   "messaging_product": "whatsapp",
//!   "recipient_type": "individual",
//!   "to": "<wa_id>",
//!   "type": "interactive",
//!   "interactive": {
//!     "type": "order_details",
//!     "body": { "text": "Order <reference_id>" },
//!     "action": {
//!       "name": "review_and_pay",
//!       "parameters": {
//!         "reference_id": "<reference_id>",
//!         "type": "physical-goods",
//!         "payment_type": "<payment_type>",
//!         "currency": "INR",
//!         "total_amount": { "value": <minor units>, "offset": 100 },
//!         "order": {
//!           "status": "pending",
//!           "items": [
//!             { "retailer_id": "...", "name": "...",
//!               "amount": { "value": <minor units>, "offset": 100 },
//!               "quantity": 1 }
//!           ],
//!           "subtotal": { "value": <minor units>, "offset": 100 },
//!           "tax":      { "value": <minor units>, "offset": 100 },
//!           "shipping": { "value": <minor units>, "offset": 100 },
//!           "discount": { "value": <minor units>, "offset": 100 }
//!         }
//!       }
//!     }
//!   }
//! }
//! ```
//!
//! ## The Meta `value` / `offset` convention
//!
//! Meta's payments API encodes monetary amounts as `{ "value": <int>,
//! "offset": <int> }` where `value / offset` is the human-readable amount.
//! For 2-decimal currencies (INR, USD, EUR, GBP, …) the offset is **100**
//! and `value` is the amount in the **minor unit** (paise, cents). The TS
//! hard-codes `offset: 100` (line 1729) — we do the same. Callers who need
//! a different offset (e.g. zero-decimal JPY) are out of scope for this
//! slice; matching the TS comes first.
//!
//! ## What this slice does **not** do
//!
//! * Auth / project ownership checks — callers must pass an already-
//!   authorised `&Project` (matching the `getProjectById` arg in TS).
//! * Contact resolution — the TS reads the `contactId` -> `waId` mapping
//!   off Mongo before calling. We accept the WA id directly via
//!   [`SendOrderDetailsReq::to`] / [`SendOrderStatusReq::to`].
//! * `revalidatePath` and Next.js cache concerns.
//!
//! ## Meta API version
//!
//! The TS hard-codes `const API_VERSION = 'v23.0';` at the top of
//! `whatsapp.actions.ts`. We pin the same default at the [`MetaClient`]
//! construction site (callers own the `MetaClient` and pick the version).

#![forbid(unsafe_code)]

mod dto;
mod sender;

pub use dto::{OrderItem, SendOrderDetailsReq, SendOrderStatusReq, SendOutcome};
pub use sender::OrdersSender;

/// Mongo collection name for outgoing message logs.
///
/// TS reference (`whatsapp.actions.ts` line 1746 / 1812):
/// ```text
/// db.collection('outgoing_messages').insertOne({ ... })
/// ```
pub const OUTGOING_MESSAGES_COLL: &str = "outgoing_messages";

/// Mongo collection name for contacts. The TS bumps `lastMessage` /
/// `lastMessageTimestamp` on the contact row after every successful send
/// (lines 1752-1755 and 1818-1821).
pub const CONTACTS_COLL: &str = "contacts";

/// Meta Graph API version the TS pins. Source of truth: top of
/// `whatsapp.actions.ts`:
/// ```text
/// const API_VERSION = 'v23.0';
/// ```
pub const META_API_VERSION: &str = "v25.0";

/// Meta `value` / `offset` convention. For 2-decimal currencies (INR, USD,
/// EUR, GBP, …) the TS hard-codes 100. See module-level docs for the wider
/// note on what this means and what's out of scope.
pub const MONEY_OFFSET_2DP: i64 = 100;
