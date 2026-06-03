//! # sabcheckout-affiliates
//!
//! HTTP surface for SabCheckout Affiliates.
//! Backs the `sabcheckout_affiliates` Mongo collection. Mounted under
//! `/v1/sabcheckout/affiliates`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
