//! # sabshow-versions
//!
//! HTTP surface for deck version snapshots. Mounted under
//! `/v1/sabshow/versions`.
//!
//! ```ignore
//! .nest("/v1/sabshow/versions", sabshow_versions::router::<AppState>())
//! ```
//!
//! The actual deck-tree blob (`deck + slides + elements` JSON) lives in
//! SabFiles. This crate only stores the metadata pointer
//! (`snapshotFileId`) — the TS server action serialises and uploads.
//!
//! Restore is coordinated by the TS layer (not this crate): fetch the
//! blob, then replay it into `sabshow-decks` / `sabshow-slides` /
//! `sabshow-elements` via their HTTP surfaces.
//!
//! Mongo collection: `sabshow_versions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
