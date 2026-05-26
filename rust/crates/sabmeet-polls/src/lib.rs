//! # sabmeet-polls
//!
//! In-meeting polls. A poll belongs to a SabMeet room and has N options;
//! votes are tallied by appending the voter id / display name to the
//! option's `voters` array.
//!
//! Mongo collection: `meet_polls`.
//!
//! TODO(integrator): add to workspace `members` and mount under
//! `/v1/sabmeet/polls`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
