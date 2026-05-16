//! # crm-milestones
//!
//! HTTP surface for the Milestone entity. Project deliverable markers with
//! optional parent (for nested milestones), due date, progress (0..100),
//! priority, status, owner, and tags.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
