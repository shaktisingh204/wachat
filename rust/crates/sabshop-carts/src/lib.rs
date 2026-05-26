//! # sabshop-carts
//!
//! HTTP surface for shopping carts. Reads/writes the `sabshop_carts`
//! Mongo collection. Carts may be owned by a customerId or by a
//! guestSessionId, and expire automatically after `expiresAt`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
