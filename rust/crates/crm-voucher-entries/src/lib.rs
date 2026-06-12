//! # crm-voucher-entries
//!
//! HTTP surface for Voucher Entry entity. Individual ledger postings
//! (debits + credits) that hang off a Voucher Book. Each entry must
//! balance (sum of debits == sum of credits).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
