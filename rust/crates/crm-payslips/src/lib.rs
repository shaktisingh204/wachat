//! # crm-payslips
//!
//! HTTP surface for the Payslip entity. Per-employee, per-pay-period
//! pay record with basic/hra/allowances/deductions, gross + net, and
//! issuance status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
