//! # sabshow-elements
//!
//! HTTP surface for the per-slide drawable rectangles (text, image,
//! shape, chart, video, code). Mounted under `/v1/sabshow/elements`.
//!
//! ```ignore
//! .nest("/v1/sabshow/elements", sabshow_elements::router::<AppState>())
//! ```
//!
//! Visibility inherits from the parent Deck (`sabshow_decks`) via the
//! parent Slide (`sabshow_slides`). Writes require deck visibility plus
//! that the row is not `locked: true`.
//!
//! Mongo collection: `sabshow_elements`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
