//! # sabbackstage-public-pages
//!
//! HTTP surface for the SabBackstage Public Page entity. Each row
//! binds a public `slug` → host event in `crm_events`, with a hero
//! image (SabFiles), headline, description, and theme JSON. Surfaces
//! under `/event/[pageSlug]` in Next.js.
//!
//! Backs the `sabbackstage_public_pages` collection. Admin routes
//! mount at `/v1/sabbackstage/public-pages`. The public slug
//! resolver is `/public/by-slug/:slug` (unauthenticated).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
