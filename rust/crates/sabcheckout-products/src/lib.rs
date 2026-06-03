//! # sabcheckout-products
//!
//! HTTP surface for SabCheckout SabcheckoutProducts.
//! Mounted under `/v1/sabcheckout/products`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
