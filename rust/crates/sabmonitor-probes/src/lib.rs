//! # sabmonitor-probes
//!
//! Per-region probe agent registry. Each probe agent process advertises its
//! region + label here so the UI can show which probes are online.
//! Mount under `/v1/sabmonitor/probes`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
