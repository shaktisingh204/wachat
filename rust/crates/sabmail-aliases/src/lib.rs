//! # sabmail-aliases
//!
//! SabMail — alias addresses. Mongo collection: `sabmail_aliases`.
//!
//! TODO(integrator): add workspace member + mount `/v1/sabmail/aliases`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
