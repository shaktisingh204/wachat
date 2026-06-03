//! # sabsense-floor-pricing
//!
//! HTTP surface for SabSense FloorPricings.
//! Backs the `sabsense_floor_pricing` Mongo collection. Mounted under
//! `/v1/sabsense/floor_pricings`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
