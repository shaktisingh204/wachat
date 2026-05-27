//! # sablens-actions-log
//!
//! Append-only timeline of everything that happened in a SabLens session
//! (joins, leaves, annotations, snapshots, chat, elevations, file
//! transfers). Used by the technician console "activity rail" and by
//! after-the-fact session review.
//!
//! Mongo collection: `sablens_actions_log`. Mount under
//! `/v1/sablens/actions-log`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
