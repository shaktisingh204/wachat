//! # sabcreator-role-assignments
//!
//! Binds a user (`userId` — the role recipient) to a Role within a given
//! SabCreator App. The tenant owner is tracked via `ownerUserId`.
//!
//! Mongo collection: `sabcreator_role_assignments`. Mount under
//! `/v1/sabcreator/role-assignments`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
