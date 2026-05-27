//! # sabwriter-documents
//!
//! SabWriter document entity. A SabWriter document is an editable
//! collaborative draft (TipTap / ProseMirror JSON content) owned by a
//! single SabNode user and optionally shared with collaborators in the
//! same tenant. Documents progress through:
//!
//!   draft → in_review → approved → sent_for_signature
//!
//! Once a document is sent for signature, the TS layer instantiates a
//! `sabsign-envelopes` entity referencing the latest version of this
//! document.
//!
//! Collection: `sabwriter_documents`. The content body is stored as a
//! `serde_json::Value` so the TipTap schema can evolve without breaking
//! Rust types.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
