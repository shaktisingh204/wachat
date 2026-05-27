//! # sabworkerly-invoices
//!
//! Client-facing invoices generated from approved timesheets.
//! Mounts at `/v1/sabworkerly/invoices`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
