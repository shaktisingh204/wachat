//! # crm-travel
//!
//! HTTP surface for the Travel Request entity. Tracks employee
//! business-trip requests: origin/destination, dates, mode, estimated
//! vs actual cost, approver, and status workflow. Reads/writes
//! `crm_travel_requests`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
