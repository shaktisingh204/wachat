//! # crm-project-tasks
//!
//! HTTP surface for the Project Task entity. Project-scoped task with
//! assignee + priority + status + due date + progress + tags.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
