//! # sabnotebook-notebooks
//!
//! HTTP surface for the SabNotebook **Notebook** entity — a container that
//! groups sections and notes. Supports color theming, SabFiles cover images,
//! optional nesting (parentId), and archive lifecycle.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
