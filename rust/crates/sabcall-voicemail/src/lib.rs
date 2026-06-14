//! # sabcall-voicemail
//!
//! HTTP surface for the Voicemail entity.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
