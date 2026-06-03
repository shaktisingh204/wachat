//! # sabcheckout-analytics
//!
//! HTTP surface for SabCheckout subscription SabcheckoutAnalyticss. A SabcheckoutAnalytics describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference analyticss via item entries of type `"analytics"`.
//!
//! Backs the `sabcheckout_analytics` Mongo collection. Mounted under
//! `/v1/sabcheckout/analyticss`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
