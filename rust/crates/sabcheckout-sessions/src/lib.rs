//! # sabcheckout-sessions
//!
//! HTTP surface for SabCheckout payer sessions. A session captures the
//! payer's submission on the public `/pay/[pageSlug]` page —
//! contact/custom field input, selected items, computed totals — plus a
//! lifecycle status that the gateway layer flips as the payment
//! progresses.
//!
//! Backs the `sabcheckout_sessions` Mongo collection. Routes mount under
//! `/v1/sabcheckout/sessions` (admin: list/get) and
//! `/v1/sabcheckout/sessions/public` (unauthenticated: create + confirm
//! callback).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
