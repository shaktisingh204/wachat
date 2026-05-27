//! # sabassist-sessions
//!
//! HTTP surface for SabAssist remote-screen-share sessions. Mount under
//! `/v1/sabassist/sessions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
