//! # sabrewards-redemptions
//!
//! HTTP surface for the SabRewards redemption ledger. Reads/writes `sabrewards_redemptions`.
//! Each row is a single point-spend by a member against a catalog item.
//! Status transitions: pending -> fulfilled | cancelled.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
