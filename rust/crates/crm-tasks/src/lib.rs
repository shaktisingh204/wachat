//! # crm-tasks
//!
//! HTTP surface for Task entity. Title + status + priority + dueDate +
//! assignee + checklist + optional linkedKind/linkedId for polymorphic
//! association to other CRM entities.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
