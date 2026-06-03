//! # sabcheckout-digital-watermarking
//!
//! SabCheckout — Digital Watermarking CRUD.
//!
//! Mounted under `/v1/sabcheckout/digital-watermarking`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
