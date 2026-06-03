//! # sabcheckout-store-credit
//!
//! HTTP surface for SabCheckout StoreCredits.
//! Backs the `sabcheckout_store_credit` Mongo collection. Mounted under
//! `/v1/sabcheckout/store_credits`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
