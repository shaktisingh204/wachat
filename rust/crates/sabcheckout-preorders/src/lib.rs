//! # sabcheckout-preorders
//!
//! SabCheckout — Preorders CRUD.
//!
//! Mounted under `/v1/sabcheckout/preorders`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
