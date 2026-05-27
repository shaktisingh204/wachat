//! # sabtables-automations
//!
//! Automation entity for SabTables. A document carries one trigger and
//! an ordered list of action steps. The runtime engine that fires
//! triggers lives outside this crate — these handlers only own the
//! CRUD surface plus a `run-now` endpoint that returns a stubbed
//! execution payload for the UI test-button.
//!
//! Mongo collection: `sabtables_automations`. Mount under
//! `/v1/sabtables/automations`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
