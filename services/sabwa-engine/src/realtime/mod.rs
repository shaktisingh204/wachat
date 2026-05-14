//! Real-time delivery layer for SabWa.
//!
//! Implements the architecture described in `SABWA_PLAN.md` §5:
//!
//! ```text
//!  Baileys worker ──PUBLISH──▶ Redis (sabwa:{sessionId}:events)
//!                                       │
//!                                       │ SUBSCRIBE (one per client)
//!                                       ▼
//!                          ┌─────────────────────────┐
//!                          │  WebSocket (ws::*)      │
//!                          │  Server-Sent Events     │
//!                          │  (sse::*)               │
//!                          └─────────────────────────┘
//! ```
//!
//! The worker only knows about Redis; the HTTP layer takes care of fanning
//! each session's pub/sub channel out to every connected browser tab.
//!
//! ## Module layout
//!
//! - [`events`] — typed [`SabwaEvent`] enum sent on the wire.
//! - [`pubsub`] — publish/subscribe helpers around `redis::aio::PubSub`.
//! - [`ws`]     — Axum WebSocket handler that subscribes per-client.
//! - [`sse`]    — Axum Server-Sent Events handler with the same fan-out.
//!
//! TODO: mount via routes::mod with
//! `.nest("/realtime", realtime::ws::router().merge(realtime::sse::router()))`.

pub mod events;
pub mod pubsub;
pub mod sse;
pub mod ws;

pub use events::{
    ChatEvent, ChatPayload, MessageEvent, MessagePayload, MessageStatusEvent, PairCodeEvent,
    PresenceEvent, QrEvent, SabwaEvent, StatusEvent, TypingEvent,
};
pub use pubsub::{publish, subscribe};
