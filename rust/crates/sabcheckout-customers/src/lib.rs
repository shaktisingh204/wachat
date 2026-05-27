//! # sabcheckout-customers
//!
//! HTTP surface for the SabCheckout recurring-customer index. One
//! document per (page, external customer) pair. Created/updated by the
//! gateway confirm path when a subscription is established.
//!
//! Backs the `sabcheckout_customers` Mongo collection. Mounted under
//! `/v1/sabcheckout/customers`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
