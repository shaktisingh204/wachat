//! # sabmeet-dialins
//!
//! PBX dial-in directory — maps a region code (`US`, `IN`, `GB-LDN`, …)
//! to a phone number a participant may call to join by phone. PIN policy
//! controls whether the SabMeet passcode is required when joining via PSTN.
//!
//! Mongo collection: `meet_dialins`.
//!
//! TODO(integrator): add to workspace `members` and mount under
//! `/v1/sabmeet/dialins`. Per-tenant overrides may extend the same collection
//! with a `userId` scope; the global directory uses a sentinel admin id.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
