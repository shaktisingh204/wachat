//! # crm-jobs
//!
//! HTTP surface for HR Job Opening / Requisition entity. Department +
//! employment type + experience / salary range + openings + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
