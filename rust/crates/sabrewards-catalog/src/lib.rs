//! # sabrewards-catalog
//!
//! HTTP surface for the redeemable SabRewards catalog. Reads/writes
//! `sabrewards_catalog`. Each entry references a SabFiles file id for its
//! image rather than embedding a free-text URL.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
