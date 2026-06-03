//! # sabsense-revenue-share
//!
//! Sabsense - Revenue Share CRUD.
//!
//! Backs the `sabsense_revenue_share` Mongo collection. Mounted under
//! `/v1/sabsense/revenue-share`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
