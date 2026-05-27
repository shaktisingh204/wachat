//! # sabwebinar-analytics
//!
//! HTTP surface for SabWebinar aggregated analytics — computes per-webinar
//! summary stats live from the registrations, sessions, polls, and qna
//! collections (no separate analytics collection at this stage).
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabwebinar_analytics::router()` under `/v1/sabwebinar/analytics`.
//! Future: introduce a `sabwebinar_analytics` snapshot collection +
//! periodic Vercel Cron compaction.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
