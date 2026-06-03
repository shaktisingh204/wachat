//! # sabcheckout-tiered-pricing
//!
//! SabCheckout — Tiered Pricing CRUD.
//!
//! Mounted under `/v1/sabcheckout/tiered-pricing`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
