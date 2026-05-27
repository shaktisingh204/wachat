//! # sabnotebook-sections
//!
//! HTTP surface for SabNotebook **Section** entities — ordered groupings of
//! notes inside a notebook (e.g. "Inbox", "Ideas", "Work"). Scoped by
//! `userId` and filtered by `notebookId`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
