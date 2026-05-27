//! # sabpractice-time-logs
//!
//! HTTP surface for SabPractice time-log entries. Each row is a single
//! (user, task, date, hours) tuple; rollups for "this week", "billable",
//! "by client" are computed at query time on the TS side.
//!
//! Mount under `/v1/sabpractice/time-logs`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
