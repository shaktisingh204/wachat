//! # crm-probation
//!
//! HTTP surface for the Probation entity. Per-employee probation
//! period with start/end dates, evaluation criteria, overall score,
//! recommendation, and status. Reads/writes the `crm_probations`
//! collection (note: not `crm_probation_periods`).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
