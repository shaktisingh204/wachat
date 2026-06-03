//! # sabsense-direct-deals
//!
//! HTTP surface for SabSense DirectDeals.
//! Backs the `sabsense_direct_deals` Mongo collection. Mounted under
//! `/v1/sabsense/direct_deals`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
