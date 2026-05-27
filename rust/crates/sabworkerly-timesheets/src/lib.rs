//! # sabworkerly-timesheets
//!
//! Weekly timesheet records per placement. Workflow:
//!   draft → submitted → approved → invoiced
//!                    \→ rejected
//!
//! Mounts at `/v1/sabworkerly/timesheets`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
