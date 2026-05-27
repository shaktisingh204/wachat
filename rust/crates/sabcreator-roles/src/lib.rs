//! # sabcreator-roles
//!
//! App-level Role entity. Each role carries row-level security rules
//! (recordsCanRead / recordsCanEdit / recordsCanDelete) plus per-form
//! and per-page allow-lists.
//!
//! Mongo collection: `sabcreator_roles`. Mount under
//! `/v1/sabcreator/roles`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
