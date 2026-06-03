//! # sabcheckout-ab-testing
//!
//! HTTP surface for SabCheckout AbTests.
//! Backs the `sabcheckout_ab_testing` Mongo collection. Mounted under
//! `/v1/sabcheckout/ab_tests`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
