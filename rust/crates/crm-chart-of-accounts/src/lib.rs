//! # crm-chart-of-accounts
//!
//! HTTP surface for the Chart of Account entity — the per-tenant ledger
//! heads under which voucher entries are booked. Each account belongs to
//! an account group (asset / liability / income / expense / equity), and
//! optionally rolls up to a parent account.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
