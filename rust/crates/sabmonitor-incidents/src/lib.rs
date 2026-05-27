//! # sabmonitor-incidents
//!
//! Auto-opened incidents — one row per outage window per check. Mount under
//! `/v1/sabmonitor/incidents`. Acknowledge / resolve endpoints are
//! session-authenticated.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
