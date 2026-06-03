//! # sabcheckout-taxes
//!
//! HTTP surface for SabCheckout SabcheckoutTaxs.
//! Mounted under `/v1/sabcheckout/taxes`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
