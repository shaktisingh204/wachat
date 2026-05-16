//! # crm-awards
//!
//! HTTP surface for Award Program entity. Recognition/incentive series
//! with criteria + nominations + winners.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
