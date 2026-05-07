//! # crm-banking-types
//!
//! DTOs for CRM Banking & Payments (`crm_function_plan.md` §6): bank
//! accounts, employee bank accounts (salary disbursement), and
//! reconciliation runs.

pub mod bank_account;
pub mod employee_account;
pub mod reconciliation;

pub use bank_account::*;
pub use employee_account::*;
pub use reconciliation::*;
