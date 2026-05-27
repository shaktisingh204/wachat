//! # sabops-mdm-profiles
//!
//! MDM configuration profiles (ios|android). Each profile owns a JSON
//! payload that gets delivered to enrolled mobile endpoints.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
