//! # sabcheckout-reports-mrr
//!
//! HTTP surface for SabCheckout subscription SabcheckoutMrrReports. A SabcheckoutMrrReport describes a
//! recurring billing template (interval, amount, optional trial / setup
//! fee). Pages reference mrr_reports via item entries of type `"mrr_report"`.
//!
//! Backs the `sabcheckout_reports_mrr` Mongo collection. Mounted under
//! `/v1/sabcheckout/mrr_reports`. Tenant-scoped by `userId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
