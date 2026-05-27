//! # sabcheckout-invoices
//!
//! HTTP surface for SabCheckout per-billing-cycle invoice records. One
//! document per (subscription, period) pair.
//!
//! Backs `sabcheckout_invoices`. Mounted under
//! `/v1/sabcheckout/invoices`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
