//! # sabsprints-epics
//!
//! HTTP surface for SabCheckout Epics.
//! Backs the `sabsprints_epics` Mongo collection. Mounted under
//! `/v1/sabcheckout/epics`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
