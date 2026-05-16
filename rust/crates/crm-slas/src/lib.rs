//! # crm-slas
//!
//! HTTP surface for SLA Policy entity. Priority + firstResponseMinutes +
//! resolutionMinutes + escalation + businessHoursOnly.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
