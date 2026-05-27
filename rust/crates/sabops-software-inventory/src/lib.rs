//! # sabops-software-inventory
//!
//! Installed software per endpoint. Sourced from agent-reported inventory
//! snapshots; admin UI lists/filters under `/v1/sabops/software`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
