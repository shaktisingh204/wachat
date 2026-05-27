//! # sabtables-bases
//!
//! Base entity for SabTables. A Base belongs to a Workspace and groups
//! many Tables together (Airtable parity).
//!
//! Mongo collection: `sabtables_bases`. Mount under
//! `/v1/sabtables/bases`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
