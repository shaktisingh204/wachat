//! # crm-proforma-invoices
//!
//! HTTP surface for Proforma Invoice entity. A pre-invoice quote with
//! line items + totals + validTillDate + status (Draft/Issued/Converted/
//! Cancelled/archived).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
