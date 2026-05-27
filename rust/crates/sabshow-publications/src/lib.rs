//! # sabshow-publications
//!
//! HTTP surface for public-published SabShow decks. Mounted under
//! `/v1/sabshow/publications`.
//!
//! ```ignore
//! .nest("/v1/sabshow/publications", sabshow_publications::router::<AppState>())
//! ```
//!
//! ## Public endpoint
//!
//! `GET /v1/sabshow/publications/public/{slug}` is **UNAUTHENTICATED**.
//! It powers `src/app/present/[publishSlug]/page.tsx` and must not be
//! wrapped in the global JWT auth layer. The integrator wires it
//! accordingly.
//!
//! Mongo collection: `sabshow_publications`. Slugs should carry a unique
//! index (created by the api crate's bootstrap).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
