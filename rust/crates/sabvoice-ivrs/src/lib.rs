//! # sabvoice-ivrs
//!
//! HTTP surface for the Voice IVR entity. An IVR is a named call-flow
//! whose `rootNode` is a free-form JSON tree of {menu, playback, forward,
//! voicemail, hangup, conditional} nodes with children.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
