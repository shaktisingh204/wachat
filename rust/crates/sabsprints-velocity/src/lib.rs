//! # sabsprints-velocity
//!
//! HTTP surface for SabCheckout Velocities.
//! Backs the `sabsprints_velocity` Mongo collection. Mounted under
//! `/v1/sabcheckout/velocities`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
