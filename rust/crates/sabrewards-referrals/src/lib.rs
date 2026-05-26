//! # sabrewards-referrals
//!
//! HTTP surface for SabRewards referral codes and conversion attribution. Reads/writes
//! `sabrewards_referrals`. Each row owns a referral code emitted by a member;
//! the embedded `conversions` array logs each invitee who joined / spent.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
