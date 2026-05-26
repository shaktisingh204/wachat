//! # pagesense-recordings
//!
//! Session recording metadata. The actual rrweb-style event stream is
//! NOT stored in Mongo — it lands in SabFiles (R2) and this crate
//! tracks `eventsFileId` plus filters/duration so the recordings list
//! page can render without loading event data.
//!
//! Mongo collection: `pagesense_recordings`.
//!
//! TODO: the snippet currently posts batched events to ingest; the
//! "finalize a session into an rrweb file in SabFiles" worker is
//! deferred. Until that runs, `eventsFileId` may be null and the
//! detail page renders a stub player.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
