//! # sabwebinar-sessions
//!
//! HTTP surface for the SabWebinar `Session` entity — a single live
//! broadcast run of a webinar (start time, end time, peak concurrent
//! count, opaque stream URL, SFU room id placeholder).
//!
//! Mongo collection: `sabwebinar_sessions`.
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabwebinar_sessions::router()` under `/v1/sabwebinar/sessions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
