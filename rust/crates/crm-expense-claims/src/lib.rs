//! # crm-expense-claims
//!
//! HTTP surface for the Expense Claim entity. Employee reimbursement
//! requests with category, amount, receipt link (SabFile URL), and
//! approval workflow. Reads/writes `crm_expense_claims`. Note: receipt
//! field is a plain optional URL string — validation (must come from
//! SabFiles, not a free-text paste) lives in the TS layer.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
