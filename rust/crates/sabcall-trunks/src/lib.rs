//! # sabcall-trunks
//!
//! HTTP surface for the Voice SIP trunk entity.
//! A SIP trunk describes a carrier connection — its SIP host, transport,
//! authentication reference, negotiated codecs, channel limits and whether
//! inbound and/or outbound calling is enabled.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
