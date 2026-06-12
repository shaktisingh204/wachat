//! # crm-vouchers
//!
//! HTTP surface for Voucher Book entity. Stores a per-type numbering
//! series (prefix + counter + padding) used by accounting vouchers.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
