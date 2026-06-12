//! # crm-reconciliation
//!
//! HTTP surface for Bank Reconciliation runs. Each document represents a
//! reconciliation pass over an `account` for a `[periodStart, periodEnd]`
//! window with opening/closing balances and matched/unmatched counts.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
