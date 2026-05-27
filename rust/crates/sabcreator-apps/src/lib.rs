//! # sabcreator-apps
//!
//! App entity for SabCreator (Zoho Creator parity). An App is the top-level
//! container that groups forms, pages, workflows, and roles together. Each
//! App optionally links to a SabTables base for record storage.
//!
//! Mongo collection: `sabcreator_apps`. Mount under
//! `/v1/sabcreator/apps`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
