//! # sabmeet-participants
//!
//! Per-room participant log. Each row is a single join session — a user
//! who joins and leaves twice produces two rows. Scoped per `userId`
//! (the room owner / tenant), not per participant.
//!
//! Mongo collection: `meet_participants`.
//!
//! TODO(integrator): add to workspace `members` and mount under
//! `/v1/sabmeet/participants` (or nested under rooms).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
