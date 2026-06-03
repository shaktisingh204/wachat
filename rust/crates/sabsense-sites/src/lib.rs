//! # sabsense-sites
//!
//! HTTP surface for SabCheckout subscription SabsenseSites. A SabsenseSite describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference sites via item entries of type `"site"`.
//!
//! Backs the `sabsense_sites` Mongo collection. Mounted under
//! `/v1/sabcheckout/sites`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
