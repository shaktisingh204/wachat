//! # sabshow-presence
//!
//! HTTP polling fallback for SabShow's real-time collab presence.
//! Mounted under `/v1/sabshow/presence`.
//!
//! ```ignore
//! .nest("/v1/sabshow/presence", sabshow_presence::router::<AppState>())
//! ```
//!
//! The Mongo collection (`sabshow_presence`) is expected to have a TTL
//! index on `lastSeenAt` (~30s) so abandoned cursors auto-expire. Index
//! creation lives in the api crate's bootstrap, not here.
//!
//! When the real-time `IShowTransport` (WebSocket / Y.js) lands in
//! `src/lib/sabshow/transport.ts`, these endpoints become the cold-start
//! fallback path.
//!
//! Mongo collection: `sabshow_presence`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
