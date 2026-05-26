//! # sabmeet-rooms
//!
//! HTTP surface for the SabMeet module `Room` entity — a video conference
//! room with optional schedule, lobby, recording toggle, passcode, and an
//! `sfuRoomId` link to whichever WebRTC SFU backend the deployment uses.
//!
//! Scoped per `userId`. Mongo collection: `meet_rooms`.
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabmeet_rooms::router()` under `/v1/sabmeet/rooms` in the api crate.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
