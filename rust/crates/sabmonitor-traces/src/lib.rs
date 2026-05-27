//! # sabmonitor-traces
//!
//! Trace summary — one document per `traceId`, rolled up from spans
//! ingested via `sabmonitor-trace-spans`. Read-only HTTP surface (writes
//! happen as upserts inside the span-ingest handler). Mount under
//! `/v1/sabmonitor/traces`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
