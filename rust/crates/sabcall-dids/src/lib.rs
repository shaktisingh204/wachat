//! # sabcall-dids
//!
//! HTTP surface for the Voice DID (Direct-Inward-Dial / phone-number) entity.
//! A DID identifies a provisioned phone number — its country, capabilities
//! (voice/sms/mms), provisioning status, upstream provider reference and
//! recurring cost.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
