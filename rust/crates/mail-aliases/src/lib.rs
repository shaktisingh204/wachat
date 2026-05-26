//! # mail-aliases
//!
//! Hosted Mail — alias addresses. Mongo collection: `mail_aliases`.
//!
//! TODO(integrator): add workspace member + mount `/v1/mail/aliases`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
