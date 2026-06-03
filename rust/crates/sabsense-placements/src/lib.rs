//! # sabsense-placements
//!
//! HTTP surface for SabCheckout subscription SabsensePlacements. A SabsensePlacement describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference placements via item entries of type `"placement"`.
//!
//! Backs the `sabsense_placements` Mongo collection. Mounted under
//! `/v1/sabcheckout/placements`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
