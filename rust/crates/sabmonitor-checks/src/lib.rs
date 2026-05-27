//! # sabmonitor-checks
//!
//! HTTP surface for the SabMonitor `Check` entity — an external endpoint
//! (HTTP, TCP, DNS, SSL, ping, synthetic browser, API transaction) that
//! gets probed on a fixed interval from one or more probe regions.
//!
//! Mount under `/v1/sabmonitor/checks` (see `router.rs`). All routes are
//! scoped by `userId` from the JWT-validated `AuthUser`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
