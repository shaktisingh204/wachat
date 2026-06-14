//! # sabcall-credentials
//!
//! HTTP surface for the SIP credential entity. A SIP credential holds the
//! registration details an agent's softphone or device uses to connect —
//! its username, a reference to its secret (never the raw password), the
//! SIP domain it registers against, supported codecs and status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
