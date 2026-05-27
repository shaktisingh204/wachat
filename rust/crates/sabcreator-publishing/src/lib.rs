//! # sabcreator-publishing
//!
//! Publication record — a frozen, versioned snapshot of an App's forms,
//! pages, workflows, and roles. Runtime surfaces (`/app/[slug]`) read
//! the latest publication, not the draft entities, so authors can edit
//! safely.
//!
//! Mongo collection: `sabcreator_publications`. Mount under
//! `/v1/sabcreator/publications`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
