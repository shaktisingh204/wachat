//! # sabcall-applications
//!
//! HTTP surface for the Voice Application entity.
//! An Application describes *what happens on a call* — a number or domain
//! routes to an Application, which dispatches the call via a webhook, an IVR,
//! a queue, a direct dial, or an autopilot agent. It also carries recording,
//! speech-to-text and text-to-speech configuration.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
