//! # sabpublish-posts
//!
//! Multi-provider location posts. Media is referenced by SabFiles id;
//! the TS-side `publishPost` fans the body out via each provider adapter.
//! Mongo collection: `sabpublish_posts`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
