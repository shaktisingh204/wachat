//! # sabpractice-tasks
//!
//! HTTP surface for SabPractice Task entities — work items inside an
//! engagement (e.g. "Reconcile Jan bank statement"). Carries a billable
//! flag and an accumulated `hoursSpent` count, but the canonical source
//! of truth for time is `sabpractice-time-logs`.
//!
//! Mount under `/v1/sabpractice/tasks`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
