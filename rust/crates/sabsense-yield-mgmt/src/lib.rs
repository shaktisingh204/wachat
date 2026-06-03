//! # sabsense-yield-mgmt
//!
//! HTTP surface for SabSense YieldMgmts.
//! Backs the `sabsense_yield_mgmts` Mongo collection. Mounted under
//! `/v1/sabsense/yield_mgmts`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
