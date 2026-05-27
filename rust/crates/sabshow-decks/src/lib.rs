//! # sabshow-decks
//!
//! HTTP surface for SabShow's top-level Deck entity. Mounted under
//! `/v1/sabshow/decks` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabshow/decks", sabshow_decks::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! A Deck is one presentation. Slides, elements, themes, comments,
//! versions, and publications hang off a Deck via `deckId`. Decks are
//! tenant-scoped by `ownerUserId` with read-share via
//! `sharedWithUserIds[]`. Writes always require ownership.
//!
//! ## Soft delete
//!
//! `DELETE /v1/sabshow/decks/:id` sets `status: "archived"` rather than
//! removing the document. List defaults exclude archived decks.
//!
//! ## Mongo collection
//!
//! `sabshow_decks` — round-trips [`types::SabshowDeck`].

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
