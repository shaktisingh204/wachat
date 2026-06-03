//! # sabsense-bidding
//!
//! HTTP surface for SabSense Biddings.
//! Backs the `sabsense_bidding` Mongo collection. Mounted under
//! `/v1/sabsense/biddings`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
