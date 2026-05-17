//! # crm-pf-esi
//!
//! HTTP surface for the PF/ESI Record entity. Tracks monthly per-employee
//! Provident Fund and Employee State Insurance deductions, challans, and
//! deposit status. Reads/writes `crm_pf_esi_records`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
