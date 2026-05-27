//! # sabpublish-profile-fields
//!
//! Per-location canonical profile fields. One row per (location, fieldKey).
//! Acts as the source-of-truth field map propagated to provider listings
//! during push-sync. Mongo collection: `sabpublish_profile_fields`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
