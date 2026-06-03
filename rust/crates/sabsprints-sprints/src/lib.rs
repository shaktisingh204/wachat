//! # sabsprints-sprints
//!
//! HTTP surface for SabCheckout Sprints.
//! Backs the `sabsprints_sprints` Mongo collection. Mounted under
//! `/v1/sabcheckout/sprints`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
