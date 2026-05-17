//! # crm-task-categories
//!
//! HTTP surface for the TaskCategory entity — hierarchical (parent/child)
//! classification used to organise project tasks per tenant.
//! Reads/writes `crm_task_categories`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
