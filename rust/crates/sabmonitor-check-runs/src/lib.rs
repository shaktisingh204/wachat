//! # sabmonitor-check-runs
//!
//! Time-series record of every check invocation. Writes come from probe
//! agents via `POST /v1/sabmonitor/check-runs/report` (probe-token
//! authenticated by the API layer — the Rust handler here trusts the
//! resolved `AuthUser`).
//!
//! Reads are session-scoped (UI list + detail).
//!
//! **High-volume collection** — apps using SabMonitor at scale should TTL
//! this collection (e.g. drop runs older than 30/90 days) and add a
//! `{checkId, ts}` compound index. See TS index migration TODO.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
