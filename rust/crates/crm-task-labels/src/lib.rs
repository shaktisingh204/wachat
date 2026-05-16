//! # crm-task-labels
//!
//! HTTP surface for the TaskLabel entity — color-coded classification labels
//! applied to tasks. Each label is scoped to a tenant (`userId`) and carries
//! presentation (color, icon) plus a denormalized usage counter.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
