//! # sabworkerly-placements
//!
//! Placement = the join of a Worker into a Job for a billable period.
//! Mounts at `/v1/sabworkerly/placements`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
