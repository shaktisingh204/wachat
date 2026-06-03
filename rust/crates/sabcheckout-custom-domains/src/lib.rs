//! # sabcheckout-custom-domains
//!
//! HTTP surface for SabCheckout custom domains.
//! Backs the `sabcheckout_custom_domains` Mongo collection.
//! Mounted under `/v1/sabcheckout/custom-domains`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
