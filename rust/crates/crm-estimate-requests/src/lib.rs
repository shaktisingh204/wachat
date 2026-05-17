//! # crm-estimate-requests
//!
//! HTTP surface for the Estimate Request entity. Lead-style intake from
//! prospects asking for a quote — captures contact info, requirements,
//! budget range, and routes through a pending → in_review → quoted/
//! declined workflow. Reads/writes `crm_estimate_requests`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
