//! # crm-taskboard-columns
//!
//! HTTP surface for the Taskboard Column entity. Kanban board column
//! definitions: name + board + project + display order + WIP limit +
//! default status mapping.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
