//! # crm-petty-cash
//!
//! HTTP surface for Petty Cash Float entity. Tracks custodian, branch,
//! opening balance, current balance, top-ups, and voucher payouts.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
