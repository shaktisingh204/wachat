//! # sabsign-fields
//!
//! Cross-envelope field analytics. The canonical place fields live is
//! inside `esign_envelopes.fields[]`. This crate exposes a read-only
//! aggregation surface so the UI can answer questions like:
//!
//!   * "How many signature fields are still unfilled across all my
//!     in-progress envelopes?"
//!   * "Which field type has the highest decline rate?"
//!
//! Field type catalog (`signature | initials | date | text | checkbox |
//! dropdown`) is enforced via `VALID_FIELD_TYPES`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
