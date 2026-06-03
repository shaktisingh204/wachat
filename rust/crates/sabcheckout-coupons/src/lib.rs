//! # sabcheckout-coupons
//!
//! HTTP surface for SabCheckout SabcheckoutCoupons.
//! Mounted under `/v1/sabcheckout/coupons`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
