//! # sabsign-templates
//!
//! Reusable templates. A template is essentially a "draft envelope skeleton":
//! a source doc + pre-placed fields + recipient role slots (no concrete signer
//! emails). Instantiating a template fills the role slots with real signers
//! and creates a new envelope.
//!
//! Reads/writes `esign_templates`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
