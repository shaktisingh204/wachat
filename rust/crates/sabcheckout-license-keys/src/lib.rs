//! # sabcheckout-license-keys
//!
//! SabCheckout — License Keys CRUD.
//!
//! Mounted under `/v1/sabcheckout/license-keys`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
