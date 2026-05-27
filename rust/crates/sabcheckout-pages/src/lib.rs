//! # sabcheckout-pages
//!
//! HTTP surface for the SabCheckout Page entity. A SabCheckout Page is
//! the user-facing, brandable payment page hosted at
//! `/pay/[pageSlug]` — it captures display text, theme, the buyable
//! items (one-off amounts and/or recurring plan refs), required payer
//! fields, and success/cancel redirects.
//!
//! Backs the `sabcheckout_pages` Mongo collection. All routes mount
//! under `/v1/sabcheckout/pages` and are tenant-scoped by
//! `userId == AuthUser.user_id`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
