//! # sabtables-workspaces
//!
//! Workspace entity for SabTables — a workspace groups a set of bases
//! and carries display metadata (color/icon) plus a member list.
//!
//! Mongo collection: `sabtables_workspaces`. Mount router under
//! `/v1/sabtables/workspaces`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
