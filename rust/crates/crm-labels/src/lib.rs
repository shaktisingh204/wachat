//! # crm-labels
//!
//! HTTP surface for the Label foundational lookup entity. Lightweight
//! per-row marker used by chat/inbox/task surfaces. Distinct from `tags`:
//! labels are typically system-defined and lower-cardinality.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
