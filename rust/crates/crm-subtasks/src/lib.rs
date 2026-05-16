//! # crm-subtasks
//!
//! HTTP surface for Subtask entity. A subtask is a child task that belongs
//! to a parent `crm_tasks` (`parent_kind = "task"`) or `crm_project_tasks`
//! (`parent_kind = "project_task"`) document.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
