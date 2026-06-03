//! # sabcheckout-fraud-prevention
//!
//! HTTP surface for sabcheckout-fraud-prevention.
//! Mounted under `/v1/sabcheckout/fraud-prevention`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
