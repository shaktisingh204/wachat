//! # crm-succession
//!
//! HTTP surface for Succession Plan entity. Role + current incumbent +
//! successors list + overall readiness + critical-role flag + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
