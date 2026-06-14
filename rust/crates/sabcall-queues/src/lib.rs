//! # sabcall-queues
//!
//! HTTP surface for the Voice call-queue entity.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
