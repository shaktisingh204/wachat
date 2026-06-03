//! # sabsense-apps
//!
//! HTTP surface for SabCheckout subscription SabsenseApps. A SabsenseApp describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference apps via item entries of type `"app"`.
//!
//! Backs the `sabsense_apps` Mongo collection. Mounted under
//! `/v1/sabcheckout/apps`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
