//! # sabshop-products
//!
//! HTTP surface for tenant-scoped SabShop products and variants.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
