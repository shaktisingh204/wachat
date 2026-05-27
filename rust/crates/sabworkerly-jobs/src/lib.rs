//! # sabworkerly-jobs
//!
//! Job postings created by a staffing agency on behalf of a client.
//! Mounts at `/v1/sabworkerly/jobs`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
