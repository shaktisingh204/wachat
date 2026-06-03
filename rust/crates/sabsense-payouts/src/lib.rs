//! # sabsense-payouts
//!
//! Sabsense - Payouts CRUD.
//!
//! Backs the `sabsense_payouts` Mongo collection. Mounted under
//! `/v1/sabsense/payouts`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
