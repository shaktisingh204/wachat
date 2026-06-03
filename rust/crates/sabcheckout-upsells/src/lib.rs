//! # sabcheckout-upsells
//!
//! HTTP surface for SabCheckout Upsells.
//! Backs the `sabcheckout_upsells` Mongo collection. Mounted under
//! `/v1/sabcheckout/upsells`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
