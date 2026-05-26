//! # sabshop-storefronts
//!
//! HTTP surface for tenant-scoped SabShop storefronts. Each storefront
//! is a public store reachable at `/store/<slug>` with its own theme,
//! currency, shipping zones and tax rules. Reads/writes the
//! `sabshop_storefronts` Mongo collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
