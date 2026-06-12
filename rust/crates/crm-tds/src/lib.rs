//! # crm-tds
//!
//! HTTP surface for the TDS Record entity. Tracks per-employee quarterly
//! TDS deductions, deposit challans and certificates.
//! Reads/writes `crm_tds_records`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
