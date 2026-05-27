//! # sabtables-tables
//!
//! Table-schema entity — defines fields, the primary field id, and the
//! cached record count. Field types are an exhaustive enum (Airtable
//! parity).
//!
//! Mongo collection: `sabtables_tables`. Mount under
//! `/v1/sabtables/tables`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
