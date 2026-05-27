//! # sabpublish-reviews
//!
//! Cross-provider review feed. The Rust handler stores reviews ingested
//! by the (deferred) review-pull worker; the TS server action issues
//! replies through the provider adapters. Mongo collection: `sabpublish_reviews`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
