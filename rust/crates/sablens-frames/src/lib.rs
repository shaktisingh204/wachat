//! # sablens-frames
//!
//! Captured camera frame snapshots. The actual JPEG bytes live in
//! SabFiles (`file_id`). This crate stores only the metadata.
//!
//! Mongo collection: `sablens_frames`. Mount under `/v1/sablens/frames`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
