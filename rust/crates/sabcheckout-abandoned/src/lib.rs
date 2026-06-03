//! # sabcheckout-abandoned
//!
//! HTTP surface for SabCheckout abandoned carts.
//! Backs the `sabcheckout_abandoned` Mongo collection.
//! Mounted under `/v1/sabcheckout/abandoned`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
