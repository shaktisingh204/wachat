//! # sabconnect-manuals
//!
//! Manual / wiki pages for SabConnect. Pages can nest under a parent
//! (forming a tree), live inside a group, and have a published flag.
//!
//! Mount under `/v1/sabconnect/manuals`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
