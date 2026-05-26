//! # sabsprints-stories
//!
//! HTTP surface for the Story entity. A backlog work item that can be
//! optionally assigned to a sprint and/or grouped under an epic. Carries
//! story points, acceptance criteria, status column, and priority.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
