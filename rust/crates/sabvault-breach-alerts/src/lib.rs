//! # sabvault-breach-alerts
//!
//! HTTP surface for SabCheckout subscription SabvaultBreachAlerts. A SabvaultBreachAlert describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference alerts via item entries of type `"alert"`.
//!
//! Backs the `sabvault_breach_alerts` Mongo collection. Mounted under
//! `/v1/sabcheckout/alerts`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
