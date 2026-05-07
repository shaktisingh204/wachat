//! # crm-accounting-types
//!
//! DTOs for CRM Accounting (`crm_function_plan.md` §4): chart of
//! accounts, voucher books, and accounting report request envelopes.

pub mod chart_of_accounts;
pub mod reports;
pub mod voucher_book;

pub use chart_of_accounts::*;
pub use reports::*;
pub use voucher_book::*;
