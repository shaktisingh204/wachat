//! # sabtables-views
//!
//! View entity for SabTables. A View binds a kind (grid / kanban /
//! gallery / calendar / gantt / form) to a table together with a
//! free-form `configJson` describing filters, sort, group, color-by,
//! visible fields, etc.
//!
//! Mongo collection: `sabtables_views`. Mount under
//! `/v1/sabtables/views`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
