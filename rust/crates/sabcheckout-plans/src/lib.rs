//! # sabcheckout-plans
//!
//! HTTP surface for SabCheckout subscription Plans. A Plan describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference plans via item entries of type `"plan"`.
//!
//! Backs the `sabcheckout_plans` Mongo collection. Mounted under
//! `/v1/sabcheckout/plans`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
