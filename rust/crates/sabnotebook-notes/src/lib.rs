//! # sabnotebook-notes
//!
//! HTTP surface for SabNotebook **Note** entities — the unit of content.
//! A note belongs to a section, has a kind (`text` | `checklist` | `audio`
//! | `sketch` | `file`), opaque `blocksJson` payload, tags, pin and archive
//! state. Search, pin, archive endpoints included.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
