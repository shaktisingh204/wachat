//! # sabwebinar-chat
//!
//! HTTP surface for the SabWebinar `ChatMessage` entity — live chat
//! between host and attendees. The public **send** and **list-recent**
//! endpoints are unauthenticated.
//!
//! Mongo collection: `sabwebinar_chat`.
//!
//! TODO(integrator): add this crate to `rust/Cargo.toml` `members` and
//! mount `sabwebinar_chat::router()` under `/v1/sabwebinar/chat`.
//! Real-time fan-out is delegated to the `IWebinarTransport` (see
//! `src/lib/sabwebinar/transport.ts`); HTTP here is the persistence layer.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
