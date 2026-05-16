//! # crm-goals
//!
//! HTTP surface for the HR Goal / OKR entity. Title + description +
//! employee + period + target + achieved + progress + weight + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
