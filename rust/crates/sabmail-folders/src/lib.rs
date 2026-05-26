//! # sabmail-folders
//!
//! SabMail — per-account folder tree. Mongo collection: `sabmail_folders`.
//!
//! TODO(integrator): workspace member + mount `/v1/sabmail/folders`.
//! Bootstrap helper: on first account access, seed inbox/sent/drafts/trash/spam.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
