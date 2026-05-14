//! Shared API DTOs for the SabWa engine.
//!
//! These types are the on-the-wire JSON contracts the Next.js side consumes
//! (server actions, REST handlers in `routes::*`, and SSE event payloads
//! pushed by `realtime::*`). They intentionally overlap — but are NOT the
//! same as — the storage models under [`crate::db`]: DB models hold BSON
//! `ObjectId`s, dates as `bson::DateTime`, and are owned by the persistence
//! agent; these DTOs use `String` IDs and `chrono::DateTime<Utc>` so they
//! serialise cleanly to JSON for the Next.js layer.
//!
//! Module layout follows the agent split spelled out in `SABWA_PLAN.md`
//! §14: `common` for shared primitives, `api` for request/response shapes,
//! `events` for real-time event payloads.

pub mod api;
pub mod common;
pub mod events;

pub use common::*;
