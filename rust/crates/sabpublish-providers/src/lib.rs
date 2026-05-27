//! # sabpublish-providers
//!
//! Per-location listing-provider connection records. One document per
//! (location, providerId) pair. Holds the external listing id and an
//! encrypted credentials reference once the OAuth handshake is wired
//! in (deferred — currently records mock connections only).
//!
//! Mongo collection: `sabpublish_providers`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
