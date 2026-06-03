//! # sabcheckout-links
//!
//! HTTP surface for SabCheckout payment links.
//! Backs the `sabcheckout_links` Mongo collection.
//! Mounted under `/v1/sabcheckout/links`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
