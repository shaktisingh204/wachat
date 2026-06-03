//! # sabcheckout-reports-churn
//!
//! HTTP surface for SabCheckout subscription SabcheckoutChurnReports. A SabcheckoutChurnReport describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference churn_reports via item entries of type `"churn_report"`.
//!
//! Backs the `sabcheckout_reports_churn` Mongo collection. Mounted under
//! `/v1/sabcheckout/churn_reports`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
