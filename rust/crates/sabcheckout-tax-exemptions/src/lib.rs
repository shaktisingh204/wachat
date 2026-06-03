//! # sabcheckout-tax-exemptions
//!
//! HTTP surface for sabcheckout-tax-exemptions.
//! Mounted under `/v1/sabcheckout/tax-exemptions`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
