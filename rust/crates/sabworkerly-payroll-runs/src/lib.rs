//! # sabworkerly-payroll-runs
//!
//! Aggregated payroll runs that pay workers for approved timesheets.
//! Mounts at `/v1/sabworkerly/payroll-runs`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
