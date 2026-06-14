//! # sabcall-domains
//!
//! HTTP surface for the SIP domain entity. A SIP domain identifies a routable
//! voice domain (e.g. `acme.sip.sabnode.com`) — its friendly label, whether
//! calls are recorded, the default application to dispatch to, and its
//! provisioning status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
