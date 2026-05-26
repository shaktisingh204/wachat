//! # sabrewards-members
//!
//! HTTP surface for per-customer SabRewards membership. Reads/writes
//! `sabrewards_members`. One document per (programId, customerId).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
