//! # sabcheckout-gift-cards
//!
//! HTTP surface for SabCheckout GiftCards.
//! Backs the `sabcheckout_gift_cards` Mongo collection. Mounted under
//! `/v1/sabcheckout/gift_cards`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
