//! # crm-interviews
//!
//! HTTP surface for the HR Interview entity. Candidate + round +
//! interview type + interviewers + scheduled date + feedback +
//! rating + recommendation.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
