//! # sabwebinar-polls
//!
//! HTTP surface for the SabWebinar `Poll` entity — multi-option polls
//! pushed live to attendees. Public vote endpoint is unauthenticated.
//!
//! Mongo collection: `sabwebinar_polls`.
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabwebinar_polls::router()` under `/v1/sabwebinar/polls`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
