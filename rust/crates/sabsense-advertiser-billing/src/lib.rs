//! # sabsense-advertiser-billing
//!
//! Sabsense - Advertiser Billing CRUD.
//!
//! Backs the `sabsense_advertiser_billing` Mongo collection. Mounted under
//! `/v1/sabsense/advertiser-billing`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
