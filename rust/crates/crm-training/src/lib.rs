//! # crm-training
//!
//! HTTP surface for the HR Training program entity. A training has a
//! name + type + delivery mode + trainer + schedule + denormalized
//! enrollment counters.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
