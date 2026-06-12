//! # crm-bank-transactions
//!
//! HTTP surface for the Bank Transaction entity. Records per-account
//! debit/credit movements (CSV statement import + manual entry).
//! Reads/writes `crm_bank_transactions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
