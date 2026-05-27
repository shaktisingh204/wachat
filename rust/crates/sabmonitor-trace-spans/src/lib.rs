//! # sabmonitor-trace-spans
//!
//! APM trace span ingest + query. Spans are ingested via the OTLP-shaped
//! `POST /v1/sabmonitor/trace-spans/ingest` endpoint — auth comes from the
//! standard JWT-resolved `AuthUser`, but the API layer should mint a
//! tenant-scoped *trace token* and exchange it before calling here. List +
//! detail are session-authenticated.
//!
//! **High-volume collection.** Recommend a TTL index on `startedAt` and a
//! compound index on `{traceId}`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
