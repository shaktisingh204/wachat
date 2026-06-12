//! # crm-payment-accounts
//!
//! HTTP surface for Payment Account entity. Bank/cash/UPI/wallet/employee
//! account with opening balance + currency + bankDetails sub-doc.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
