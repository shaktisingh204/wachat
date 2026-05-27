//! # sabwriter-suggestions
//!
//! "Track-changes" style proposed edits. Each suggestion carries an
//! anchor range and a `proposalJson` payload (a list of TipTap insert /
//! delete steps that can be applied against the document state). The
//! document owner reviews and either accepts or rejects each suggestion.
//!
//! Collection: `sabwriter_suggestions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
