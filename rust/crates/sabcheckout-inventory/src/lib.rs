//! # sabcheckout-inventory
//!
//! SabCheckout — Inventory CRUD.
//!
//! Mounted under `/v1/sabcheckout/inventory`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
