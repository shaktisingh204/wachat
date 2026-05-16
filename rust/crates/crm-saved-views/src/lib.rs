//! # crm-saved-views
//!
//! HTTP surface for the SavedView entity — per-entity column +
//! filter + sort presets, scoped per (user, entity).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
