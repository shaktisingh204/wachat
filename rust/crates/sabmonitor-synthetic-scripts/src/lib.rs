//! # sabmonitor-synthetic-scripts
//!
//! Browser-transaction scripts — ordered list of synthetic steps that a
//! headless browser probe replays (navigate/click/type/wait/assert).
//! Mount under `/v1/sabmonitor/synthetic-scripts`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
