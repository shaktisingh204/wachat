//! # sabpublish-locations
//!
//! Canonical business locations for SabPublish. Each location is the
//! single source-of-truth NAP (name, address, phone) record that gets
//! synced out to listing providers (GBP, Yelp, Bing, Apple, Facebook).
//!
//! Mongo collection: `sabpublish_locations`. Soft-delete via `status`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
