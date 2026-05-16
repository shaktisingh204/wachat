//! # crm-loans
//!
//! HTTP surface for Loan entity. Principal + interest + tenure +
//! schedule + payment history. Reads/writes `crm_loans`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
