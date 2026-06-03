//! # sabsense-ad-units
//!
//! HTTP surface for SabCheckout subscription SabsenseAdUnits. A SabsenseAdUnit describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference ad_units via item entries of type `"ad_unit"`.
//!
//! Backs the `sabsense_ad_units` Mongo collection. Mounted under
//! `/v1/sabcheckout/ad_units`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
