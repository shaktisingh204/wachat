//! # sabbackstage-tickets
//!
//! HTTP surface for the SabBackstage Ticket entity. Each row
//! represents a single seat issued to a named attendee, with a QR
//! code used at the door for check-in. Tickets are issued in bulk by
//! the order-completion flow (one row per `qty` on an order item).
//!
//! Backs the `sabbackstage_tickets` Mongo collection. Admin CRUD +
//! check-in routes mount under `/v1/sabbackstage/tickets`. Public
//! holder-side lookup by `orderId` is `/public/by-order/:orderId` so
//! the buyer can render printable tickets without auth.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
