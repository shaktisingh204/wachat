//! # sabmeet-recordings
//!
//! Recording sessions for a SabMeet room. The actual media file lives in
//! SabFiles — this crate stores only the SabFile id, lifecycle status,
//! duration, and optional transcript.
//!
//! Mongo collection: `meet_recordings`.
//!
//! TODO(integrator): add to workspace `members` and mount under
//! `/v1/sabmeet/recordings`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
