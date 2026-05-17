//! # crm-task-tags
//!
//! HTTP surface for the TaskTag entity — free-form, case-insensitively
//! unique tags applied to project tasks. Reads/writes `crm_task_tags`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
