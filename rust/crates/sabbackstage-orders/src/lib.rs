//! # sabbackstage-orders
//!
//! HTTP surface for the SabBackstage Order entity. Captures buyer
//! info + a snapshot of cart items + totals + a payment lifecycle
//! status (`pending → paid | failed | refunded`).
//!
//! The order is the single Mongo "transaction record" of a public
//! ticket purchase. Ticket rows (one per seat) are issued from the
//! TS server-action `confirmPublicTicketOrder(orderId, paymentRef)`
//! once the gateway returns success.
//!
//! Backs the `sabbackstage_orders` collection. Admin reads at
//! `/v1/sabbackstage/orders`. Public order creation lives at
//! `/public/create` (unauthenticated — the public page calls it).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
