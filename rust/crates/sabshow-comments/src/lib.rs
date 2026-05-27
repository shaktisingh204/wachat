//! # sabshow-comments
//!
//! HTTP surface for slide / element-anchored review threads. Mounted
//! under `/v1/sabshow/comments`.
//!
//! ```ignore
//! .nest("/v1/sabshow/comments", sabshow_comments::router::<AppState>())
//! ```
//!
//! Visibility inherits from the parent Deck. Any deck-visible user can
//! create / read / resolve comments. Body edits and deletes are
//! restricted to the comment author.
//!
//! Mongo collection: `sabshow_comments`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
