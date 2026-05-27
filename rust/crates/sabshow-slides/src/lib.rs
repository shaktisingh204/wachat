//! # sabshow-slides
//!
//! HTTP surface for SabShow Slides. Mounted under `/v1/sabshow/slides`.
//!
//! ```ignore
//! .nest("/v1/sabshow/slides", sabshow_slides::router::<AppState>())
//! ```
//!
//! Visibility inherits from the parent Deck (`sabshow_decks`): writes
//! and reads require `ownerUserId == me` or `me ∈ sharedWithUserIds`.
//! Slides themselves do not store an `ownerUserId` — they carry only the
//! `userId` of whoever inserted the row.
//!
//! Mongo collection: `sabshow_slides`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
